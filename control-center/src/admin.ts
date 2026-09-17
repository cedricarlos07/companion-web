import { Router, json as expressJson } from 'express'
import type { DbHandle } from './db.js'
import { issueLicenseFile, type LicensePayload } from './signing.js'
import { PLANS } from './plans.js'

/**
 * API admin du Control Center — usage interne Kamaloka.
 * Auth : header x-admin-key (ou cookie cc_admin pour l'UI).
 */

const ADMIN_KEY = process.env.CC_ADMIN_KEY ?? 'kamaloka-dev-admin'

/** Auth admin : header x-admin-key (API) ou cookie cc_admin (UI). */
export function adminAuthorized(req: { headers: { 'x-admin-key'?: unknown; cookie?: unknown } }): boolean {
  if (req.headers['x-admin-key'] === ADMIN_KEY) return true
  const raw = typeof req.headers.cookie === 'string' ? req.headers.cookie : ''
  const cookie = Object.fromEntries(
    raw.split(';').map((p) => {
      const i = p.indexOf('=')
      return i < 0 ? ['', ''] : [p.slice(0, i).trim(), decodeURIComponent(p.slice(i + 1).trim())]
    }),
  )
  return cookie['cc_admin'] === ADMIN_KEY
}

export function buildAdminApi(dbh: DbHandle): Router {
  const router = Router()
  router.use(expressJson())
  router.use((req, res, next) => {
    if (!adminAuthorized(req)) return res.status(401).json({ error: 'clé admin requise (x-admin-key)' })
    next()
  })

  /* ------------------------------ Customers ------------------------------- */

  router.get('/customers', async (_req, res) => {
    const rows = await dbh.query(
      `SELECT c.*, count(l.id)::int AS licenses_total
       FROM customers c LEFT JOIN licenses l ON l.customer_id = c.id AND l.status = 'active'
       GROUP BY c.id ORDER BY c.created_at DESC`,
    )
    res.json({ customers: rows })
  })

  router.post('/customers', async (req, res) => {
    const { name, contactEmail, country, notes } = req.body as Record<string, string>
    if (!name) return res.status(400).json({ error: 'nom requis' })
    const rows = await dbh.query<{ id: string }>(
      `INSERT INTO customers (name, contact_email, country, notes) VALUES ('${name.replace(/'/g, "''")}',
       '${(contactEmail ?? '').replace(/'/g, "''")}', '${(country ?? '').replace(/'/g, "''")}', '${(notes ?? '').replace(/'/g, "''")}')
       RETURNING id`,
    )
    res.json({ customerId: rows[0].id })
  })

  /* ------------------------------- Licenses -------------------------------- */

  router.post('/licenses', async (req, res) => {
    const { customerId, plan, months = 12, maxInstances, expiresAt, licenseId: customId } = req.body as {
      customerId?: string; plan?: string; months?: number; maxInstances?: number; expiresAt?: string; licenseId?: string
    }
    if (!customerId || !PLANS[plan ?? '']) return res.status(400).json({ error: 'customerId et plan (pilot|business|enterprise) requis' })
    const customer = (await dbh.query<{ name: string }>(`SELECT name FROM customers WHERE id = '${customerId}' LIMIT 1`))[0]
    if (!customer) return res.status(404).json({ error: 'client introuvable' })

    const seqRows = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM licenses`)
    const licenseId = customId ?? `LIC-KAM-${new Date().getFullYear()}-${String(Number(seqRows[0]?.cnt ?? 0) + 1).padStart(5, '0')}`
    const def = PLANS[plan!]
    const now = new Date()
    // expiresAt explicite : contrats prorata / backdatés (utilisé aussi par les tests).
    const expiry = expiresAt ?? new Date(now.getTime() + Math.max(1, Math.floor(months)) * 30 * 86_400_000).toISOString()
    const payload: LicensePayload = {
      licenseId,
      organization: customer.name,
      plan: plan as LicensePayload['plan'],
      issuedAt: now.toISOString(),
      expiresAt: expiry,
      entitlements: def.entitlements,
    }
    const signature = issueLicenseFile(payload)
    await dbh.exec(
      `INSERT INTO licenses (license_id, customer_id, plan, status, max_instances, expires_at, entitlements, signature)
       VALUES ('${licenseId}', '${customerId}', '${plan}', 'active', ${maxInstances ?? def.maxInstances},
               '${expiry}', '${JSON.stringify(def.entitlements).replace(/'/g, "''")}'::jsonb, '${signature.replace(/'/g, "''")}')`,
    )
    res.json({
      licenseId,
      plan,
      expiresAt: expiry,
      licenseFile: signature,
      fileName: `companion-license-${licenseId.toLowerCase()}.lic`,
    })
  })

  router.post('/licenses/:licenseId/renew', async (req, res) => {
    const { months = 12 } = req.body as { months?: number }
    const rows = await dbh.query<{ license_id: string; customer_id: string; plan: string; status: string; expires_at: string | null; max_instances: number }>(
      `SELECT license_id, customer_id, plan, status, expires_at::text AS expires_at, max_instances
       FROM licenses WHERE license_id = '${req.params.licenseId.replace(/'/g, "''")}' LIMIT 1`,
    )
    const prev = rows[0]
    if (!prev) return res.status(404).json({ error: 'licence introuvable' })
    const customer = (await dbh.query<{ name: string }>(`SELECT name FROM customers WHERE id = '${prev.customer_id}'`))[0]
    const base = prev.expires_at && new Date(prev.expires_at) > new Date() ? new Date(prev.expires_at) : new Date()
    const expiresAt = new Date(base.getTime() + Math.max(1, Math.floor(months)) * 30 * 86_400_000).toISOString()
    const payload: LicensePayload = {
      licenseId: prev.license_id,
      organization: customer?.name ?? 'Client Kamaloka',
      plan: prev.plan as LicensePayload['plan'],
      issuedAt: new Date().toISOString(),
      expiresAt,
      entitlements: PLANS[prev.plan]?.entitlements ?? {},
    }
    const signature = issueLicenseFile(payload)
    await dbh.exec(`UPDATE licenses SET status = 'replaced' WHERE license_id = '${prev.license_id}' AND status = 'active'`)
    await dbh.exec(
      `INSERT INTO licenses (license_id, customer_id, plan, status, max_instances, expires_at, entitlements, signature)
       VALUES ('${prev.license_id}', '${prev.customer_id}', '${prev.plan}', 'active', ${prev.max_instances},
               '${expiresAt}', '${JSON.stringify(payload.entitlements).replace(/'/g, "''")}'::jsonb, '${signature.replace(/'/g, "''")}')`,
    )
    res.json({ licenseId: prev.license_id, renewedUntil: expiresAt, licenseFile: signature })
  })

  router.post('/licenses/:licenseId/revoke', async (req, res) => {
    await dbh.exec(
      `UPDATE licenses SET status = 'revoked', revoked_at = now() WHERE license_id = '${req.params.licenseId.replace(/'/g, "''")}' AND status = 'active'`,
    )
    res.json({ ok: true })
  })

  router.get('/licenses', async (_req, res) => {
    const rows = await dbh.query(
      `SELECT l.license_id, l.plan, l.status, l.max_instances, l.expires_at::text AS expires_at, l.created_at::text AS created_at,
              c.name AS customer_name, c.id AS customer_id,
              (SELECT count(*) FROM license_activations a WHERE a.license_id = l.license_id AND a.status = 'active')::int AS active_instances
       FROM licenses l JOIN customers c ON c.id = l.customer_id
       ORDER BY l.created_at DESC`,
    )
    res.json({ licenses: rows })
  })

  /* ------------------------------ Instances -------------------------------- */

  router.get('/instances', async (_req, res) => {
    const rows = await dbh.query(
      `SELECT a.instance_id, a.license_id, a.status, a.version, a.mode, a.counts,
              a.first_activated_at::text AS first_activated_at, a.last_heartbeat_at::text AS last_heartbeat_at,
              c.name AS customer_name
       FROM license_activations a JOIN licenses l ON l.license_id = a.license_id JOIN customers c ON c.id = l.customer_id
       ORDER BY a.last_heartbeat_at DESC NULLS LAST`,
    )
    res.json({ instances: rows })
  })

  router.post('/instances/:instanceId/reset', async (req, res) => {
    await dbh.exec(
      `UPDATE license_activations SET status = 'deactivated' WHERE instance_id = '${req.params.instanceId.replace(/'/g, "''")}'`,
    )
    res.json({ ok: true })
  })

  /* ------------------------------- Invoices -------------------------------- */

  router.get('/invoices', async (_req, res) => {
    const rows = await dbh.query(
      `SELECT i.*, c.name AS customer_name FROM invoices i JOIN customers c ON c.id = i.customer_id ORDER BY i.issued_at DESC`,
    )
    res.json({ invoices: rows })
  })

  router.post('/invoices', async (req, res) => {
    const { customerId, amountFcf, label, plan, kind } = req.body as { customerId?: string; amountFcf?: number; label?: string; plan?: string; kind?: 'license' | 'installation' }
    if (!customerId) return res.status(400).json({ error: 'customerId requis' })
    let amount = amountFcf
    if (amount === undefined && plan && PLANS[plan]) {
      amount = (kind === 'installation' ? PLANS[plan].installationFcf : PLANS[plan].priceAnnualFcf) ?? undefined
    }
    if (!amount) return res.status(400).json({ error: 'amountFcf requis (ou plan connu)' })
    const seqRows = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM invoices`)
    const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(Number(seqRows[0]?.cnt ?? 0) + 1).padStart(4, '0')}`
    const due = new Date(Date.now() + 30 * 86_400_000).toISOString()
    await dbh.exec(
      `INSERT INTO invoices (invoice_number, customer_id, label, amount_fcf, due_at)
       VALUES ('${invoiceNumber}', '${customerId}', '${(label ?? `Licence Companion ${plan ?? ''}`).replace(/'/g, "''")}', ${Math.round(amount)}, '${due}')`,
    )
    res.json({ invoiceNumber, amountFcf: Math.round(amount) })
  })

  router.post('/invoices/:invoiceNumber/paid', async (req, res) => {
    const { method = 'virement' } = req.body as { method?: string }
    const rows = await dbh.query<{ id: string; amount_fcf: string }>(
      `SELECT id, amount_fcf::text AS amount_fcf FROM invoices WHERE invoice_number = '${req.params.invoiceNumber.replace(/'/g, "''")}' LIMIT 1`,
    )
    if (!rows[0]) return res.status(404).json({ error: 'facture introuvable' })
    await dbh.exec(
      `INSERT INTO payments (invoice_id, amount_fcf, method) VALUES ('${rows[0].id}', ${rows[0].amount_fcf}, '${method.replace(/'/g, "''")}')`,
    )
    await dbh.exec(
      `UPDATE invoices SET status = 'paid', paid_at = now() WHERE invoice_number = '${req.params.invoiceNumber.replace(/'/g, "''")}'`,
    )
    res.json({ ok: true })
  })

  /* ------------------------------- Releases -------------------------------- */

  router.post('/releases', async (req, res) => {
    const { version, channel = 'stable', notes = '', minimumVersion = '0.0.0' } = req.body as Record<string, string>
    if (!version) return res.status(400).json({ error: 'version requise (ex. 1.0.2)' })
    await dbh.exec(
      `INSERT INTO releases (version, channel, notes, minimum_version)
       VALUES ('${version.replace(/'/g, "''")}', '${channel.replace(/'/g, "''")}', '${notes.replace(/'/g, "''")}', '${(minimumVersion ?? '0.0.0').replace(/'/g, "''")}')`,
    )
    res.json({ ok: true, version })
  })

  router.get('/releases', async (_req, res) => {
    const rows = await dbh.query(
      `SELECT version, channel, notes, minimum_version, published_at::text AS published_at FROM releases ORDER BY published_at DESC`,
    )
    res.json({ releases: rows })
  })

  /* ----------------------------- Portal users ------------------------------ */

  router.post('/portal-users', async (req, res) => {
    const { customerId, email, password, displayName } = req.body as Record<string, string>
    if (!customerId || !email || !password || password.length < 8) {
      return res.status(400).json({ error: 'customerId, email et password (8+) requis' })
    }
    const { hashPassword } = await import('./portal.js')
    const rows = await dbh.query<{ id: string }>(
      `INSERT INTO portal_users (customer_id, email, password_hash, display_name)
       VALUES ('${customerId}', '${email.replace(/'/g, "''")}', '${hashPassword(password).replace(/'/g, "''")}', '${(displayName ?? '').replace(/'/g, "''")}')
       RETURNING id`,
    ).catch(() => [])
    if (!rows[0]) return res.status(409).json({ error: 'email déjà utilisé ou client inconnu' })
    res.json({ portalUserId: rows[0].id })
  })

  /* ----------------------------- Demo leads ------------------------------- */

  router.get('/demo-requests', async (_req, res) => {
    const rows = await dbh.query(
      `SELECT * FROM demo_requests ORDER BY created_at DESC`,
    )
    res.json({ leads: rows })
  })

  router.post('/demo-requests/:id/status', async (req, res) => {
    const { status } = req.body as { status?: string }
    if (!status || !['new', 'contacted', 'demo_scheduled', 'won', 'lost'].includes(status)) {
      return res.status(400).json({ error: 'statut invalide' })
    }
    await dbh.exec(
      `UPDATE demo_requests SET status = '${status.replace(/'/g, "''")}' WHERE id = '${String(req.params.id).replace(/'/g, "''")}'`,
    )
    res.json({ ok: true })
  })

  /* ------------------------------ Dashboard -------------------------------- */

  /** Arrêt propre (flush PGlite avant exit) — admin uniquement. */
  router.post('/shutdown', async (_req, res) => {
    res.json({ ok: true })
    const { closeDb } = await import('./db.js')
    await closeDb()
    process.exit(0)
  })

  router.get('/dashboard', async (_req, res) => {
    const rows = await dbh.query<{
      customers: string; active_licenses: string; active_instances: string;
      unpaid_fcf: string; unpaid_count: string; heartbeats_7d: string
    }>(
      `SELECT
        (SELECT count(*) FROM customers)::text AS customers,
        (SELECT count(*) FROM licenses WHERE status = 'active')::text AS active_licenses,
        (SELECT count(*) FROM license_activations WHERE status = 'active')::text AS active_instances,
        (SELECT COALESCE(sum(amount_fcf), 0) FROM invoices WHERE status = 'sent')::text AS unpaid_fcf,
        (SELECT count(*) FROM invoices WHERE status = 'sent')::text AS unpaid_count,
        (SELECT count(*) FROM license_activations WHERE last_heartbeat_at > now() - interval '7 days')::text AS heartbeats_7d`,
    )
    res.json({ dashboard: rows[0] ?? {} })
  })

  return router
}
