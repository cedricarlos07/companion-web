import { Router, urlencoded } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { DbHandle } from './db.js'
import { adminAuthorized } from './admin.js'
import { PLANS, formatFcf } from './plans.js'

/**
 * UI interne Kamaloka — pages rendues serveur, volontairement minimales.
 * Accès : /login (clé admin) → cookie cc_admin.
 */

type Req = Request
type Res = Response

function page(title: string, body: string, adminKey?: string): string {
  const nav = ['/', 'Dashboard', '/customers', 'Clients', '/licenses', 'Licences', '/instances', 'Instances', '/invoices', 'Factures']
  const navHtml = Array.from({ length: nav.length / 2 }, (_, i) =>
    `<a href="${nav[i * 2]}${adminKey ? '' : ''}">${nav[i * 2 + 1]}</a>`).join('')
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>KamaLoka Control — ${title}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { font: 14px/1.5 system-ui, sans-serif; margin: 0; background: #f6f7f9; color: #1a1d21; }
  header { background: #101828; color: #fff; padding: 12px 24px; display: flex; gap: 20px; align-items: center; }
  header .brand { font-weight: 700; letter-spacing: .5px; }
  header nav a { color: #cbd5e1; text-decoration: none; margin-right: 14px; }
  header nav a:hover { color: #fff; }
  main { max-width: 1080px; margin: 24px auto; padding: 0 16px; }
  h1 { font-size: 20px; margin: 0 0 16px; }
  h2 { font-size: 15px; margin: 24px 0 8px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid #eef0f3; font-size: 13px; }
  th { background: #f9fafb; font-weight: 600; color: #475467; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
  .card { background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 14px; }
  .card b { display: block; font-size: 22px; }
  .card span { color: #667085; font-size: 12px; }
  form.inline { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; background: #fff; border: 1px solid #e4e7ec; border-radius: 10px; padding: 12px; margin: 10px 0 20px; }
  label { display: flex; flex-direction: column; gap: 3px; font-size: 12px; color: #475467; }
  input, select { border: 1px solid #d0d5dd; border-radius: 7px; padding: 7px 9px; font: inherit; }
  button { background: #1849a9; color: #fff; border: 0; border-radius: 7px; padding: 8px 14px; font: inherit; cursor: pointer; }
  button.ghost { background: #eef2f6; color: #1a1d21; }
  .badge { display: inline-block; border-radius: 999px; padding: 1px 9px; font-size: 12px; font-weight: 600; }
  .ok { background: #dcfae6; color: #067647; } .warn { background: #fef0c7; color: #b54708; }
  .bad { background: #fee4e2; color: #b42318; } .mute { background: #eef2f6; color: #475467; }
  pre { background: #101828; color: #d1e9ff; padding: 12px; border-radius: 10px; overflow: auto; font-size: 12px; }
  .muted { color: #667085; }
</style></head><body>
<header><span class="brand">KAMALOKA · Control Center</span><nav>${navHtml}</nav>
<form method="post" action="/logout" style="margin-left:auto"><button class="ghost" type="submit">Quitter</button></form></header>
<main>${body}</main></body></html>`
}

function badge(status: string): string {
  const map: Record<string, string> = { active: 'ok', paid: 'ok', sent: 'warn', revoked: 'bad', deactivated: 'mute', replaced: 'mute', restricted: 'warn', grace: 'warn', expired: 'warn' }
  return `<span class="badge ${map[status] ?? 'mute'}">${status}</span>`
}

export function buildUi(dbh: DbHandle): Router {
  const router = Router()
  router.use(urlencoded({ extended: false }))

  router.get('/login', (_req: Req, res: Res) => {
    res.send(page('Connexion', `<h1>Connexion interne</h1>
      <form class="inline" method="post" action="/login"><label>Clé admin<input type="password" name="key" autofocus></label>
      <button type="submit">Entrer</button></form>`))
  })

  router.post('/login', (req: Req, res: Res) => {
    if (req.body?.key !== (process.env.CC_ADMIN_KEY ?? 'kamaloka-dev-admin')) {
      return res.status(401).send(page('Connexion', '<h1>Clé invalide</h1><a href="/login">Réessayer</a>'))
    }
    res.setHeader('set-cookie', `cc_admin=${req.body.key}; Path=/; HttpOnly; SameSite=Strict`)
    res.redirect('/')
  })

  router.post('/logout', (_req: Req, res: Res) => {
    res.setHeader('set-cookie', 'cc_admin=; Path=/; Max-Age=0')
    res.redirect('/login')
  })

  router.use((req: Request, res: Response, next: NextFunction) => {
    if (req.url.startsWith('/login')) return next()
    if (!adminAuthorized(req)) return res.redirect('/login')
    next()
  })

  /* Dashboard */
  router.get('/', async (_req: Req, res: Res) => {
    const d = (
      await dbh.query<{
        customers: string; active_licenses: string; active_instances: string; unpaid_fcf: string; unpaid_count: string; heartbeats_7d: string
      }>(`SELECT
        (SELECT count(*) FROM customers)::text AS customers,
        (SELECT count(*) FROM licenses WHERE status = 'active')::text AS active_licenses,
        (SELECT count(*) FROM license_activations WHERE status = 'active')::text AS active_instances,
        (SELECT COALESCE(sum(amount_fcf), 0) FROM invoices WHERE status = 'sent')::text AS unpaid_fcf,
        (SELECT count(*) FROM invoices WHERE status = 'sent')::text AS unpaid_count,
        (SELECT count(*) FROM license_activations WHERE last_heartbeat_at > now() - interval '7 days')::text AS heartbeats_7d`)
    )[0]
    const body = `<h1>Dashboard</h1><div class="cards">
      <div class="card"><b>${d?.customers ?? 0}</b><span>Clients</span></div>
      <div class="card"><b>${d?.active_licenses ?? 0}</b><span>Licences actives</span></div>
      <div class="card"><b>${d?.active_instances ?? 0}</b><span>Instances activées</span></div>
      <div class="card"><b>${d?.heartbeats_7d ?? 0}</b><span>Instances vues (7 j)</span></div>
      <div class="card"><b>${formatFcf(Number(d?.unpaid_fcf ?? 0))}</b><span>Impayé (${d?.unpaid_count ?? 0} facture(s))</span></div>
    </div>
    <h2>Plans</h2><table><tr><th>Plan</th><th>Annuel</th><th>Mensuel</th><th>Installation</th><th>Instances max</th></tr>
    ${Object.entries(PLANS).map(([k, p]) => `<tr><td><b>${p.label}</b></td><td>${formatFcf(p.priceAnnualFcf)}</td><td>${formatFcf(p.priceMonthlyFcf)}</td><td>${formatFcf(p.installationFcf)}</td><td>${p.maxInstances}</td></tr>`).join('')}
    </table>`
    res.send(page('Dashboard', body))
  })

  /* Clients */
  router.get('/customers', async (_req: Req, res: Res) => {
    const rows = await dbh.query<{ id: string; name: string; contact_email: string; country: string; active_licenses: number }>(
      `SELECT c.*, count(l.id) FILTER (WHERE l.status = 'active')::int AS active_licenses
       FROM customers c LEFT JOIN licenses l ON l.customer_id = c.id GROUP BY c.id ORDER BY c.created_at DESC`,
    )
    res.send(page('Clients', `<h1>Clients</h1>
      <form class="inline" method="post" action="/customers">
        <label>Nom<input name="name" required></label><label>Email<input name="contactEmail" type="email"></label>
        <label>Pays<input name="country"></label><button type="submit">Ajouter client</button>
      </form>
      <table><tr><th>Client</th><th>Email</th><th>Pays</th><th>Licences actives</th><th></th></tr>
      ${rows.map((c) => `<tr><td><b>${c.name}</b></td><td>${c.contact_email || '—'}</td><td>${c.country || '—'}</td><td>${c.active_licenses}</td>
        <td><a href="/customers/${c.id}">Ouvrir</a></td></tr>`).join('')}
      </table>`))
  })

  router.post('/customers', async (req: Req, res: Res) => {
    const b = req.body as Record<string, string>
    if (b.name) {
      await dbh.exec(
        `INSERT INTO customers (name, contact_email, country) VALUES ('${b.name.replace(/'/g, "''")}', '${(b.contactEmail ?? '').replace(/'/g, "''")}', '${(b.country ?? '').replace(/'/g, "''")}')`,
      )
    }
    res.redirect('/customers')
  })

  /* Fiche client : émettre licence + facturer */
  router.get('/customers/:id', async (req: Req, res: Res) => {
    const c = (
      await dbh.query<{ id: string; name: string; contact_email: string; country: string }>(
        `SELECT * FROM customers WHERE id = '${req.params.id}' LIMIT 1`,
      )
    )[0]
    if (!c) return res.status(404).send(page('Client', '<h1>Introuvable</h1>'))
    const lics = await dbh.query<{ license_id: string; plan: string; status: string; expires_at: string | null }>(
      `SELECT license_id, plan, status, expires_at::text AS expires_at FROM licenses WHERE customer_id = '${c.id}' ORDER BY created_at DESC`,
    )
    const invs = await dbh.query<{ invoice_number: string; label: string; amount_fcf: string; status: string }>(
      `SELECT invoice_number, label, amount_fcf, status, issued_at::text AS issued_at FROM invoices WHERE customer_id = '${c.id}' ORDER BY issued_at DESC`,
    )
    const body = `<h1>${c.name}</h1><p class="muted">${c.contact_email || ''} ${c.country ? '· ' + c.country : ''}</p>
      <h2>Émettre une licence</h2>
      <form class="inline" method="post" action="/customers/${c.id}/licenses">
        <label>Plan<select name="plan">${Object.entries(PLANS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}</select></label>
        <label>Mois<input name="months" type="number" value="12" min="1"></label>
        <label>Facturer l'annuel ?<select name="invoice"><option value="1">Oui — facture automatique</option><option value="0">Non</option></select></label>
        <button type="submit">Émettre</button>
      </form>
      <h2>Licences</h2>
      <table><tr><th>Licence</th><th>Plan</th><th>Statut</th><th>Expire</th><th></th></tr>
      ${lics.map((l) => `<tr><td><b>${l.license_id}</b></td><td>${l.plan}</td><td>${badge(l.status)}</td><td>${l.expires_at ? new Date(l.expires_at).toLocaleDateString('fr-FR') : '—'}</td>
        <td><a href="/licenses/${encodeURIComponent(l.license_id)}">Ouvrir</a></td></tr>`).join('')}
      </table>
      <h2>Émettre une facture</h2>
      <form class="inline" method="post" action="/customers/${c.id}/invoices">
        <label>Montant FCFA<input name="amountFcf" type="number" required></label>
        <label>Libellé<input name="label" placeholder="Installation Companion"></label>
        <button type="submit">Émettre</button>
      </form>
      <h2>Factures</h2>
      <table><tr><th>Facture</th><th>Libellé</th><th>Montant</th><th>Statut</th></tr>
      ${invs.map((i) => `<tr><td><b>${i.invoice_number}</b></td><td>${i.label}</td><td>${formatFcf(Number(i.amount_fcf))}</td><td>${badge(i.status)}</td></tr>`).join('')}
      </table>`
    res.send(page(String(c.name), body))
  })

  router.post('/customers/:id/licenses', async (req: Req, res: Res) => {
    const b = req.body as Record<string, string>
    const customer = (await dbh.query<{ name: string }>(`SELECT name FROM customers WHERE id = '${req.params.id}' LIMIT 1`))[0]
    if (!customer) return res.redirect('/customers')
    const plan = PLANS[b.plan] ? b.plan : 'pilot'
    const months = Math.max(1, Number(b.months ?? 12))
    const seqRows = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM licenses`)
    const licenseId = `LIC-KAM-${new Date().getFullYear()}-${String(Number(seqRows[0]?.cnt ?? 0) + 1).padStart(5, '0')}`
    const expiresAt = new Date(Date.now() + months * 30 * 86_400_000).toISOString()
    const { issueLicenseFile } = await import('./signing.js')
    const signature = issueLicenseFile({
      licenseId, organization: String(customer.name), plan: plan as 'pilot' | 'business' | 'enterprise',
      issuedAt: new Date().toISOString(), expiresAt, entitlements: PLANS[plan].entitlements,
    })
    await dbh.exec(
      `INSERT INTO licenses (license_id, customer_id, plan, status, max_instances, expires_at, entitlements, signature)
       VALUES ('${licenseId}', '${req.params.id}', '${plan}', 'active', ${PLANS[plan].maxInstances}, '${expiresAt}',
               '${JSON.stringify(PLANS[plan].entitlements).replace(/'/g, "''")}'::jsonb, '${signature.replace(/'/g, "''")}')`,
    )
    if (b.invoice === '1' && PLANS[plan].priceAnnualFcf) {
      const seqInv = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM invoices`)
      const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(Number(seqInv[0]?.cnt ?? 0) + 1).padStart(4, '0')}`
      await dbh.exec(
        `INSERT INTO invoices (invoice_number, customer_id, label, amount_fcf, due_at)
         VALUES ('${invoiceNumber}', '${req.params.id}', 'Licence Companion ${PLANS[plan].label} — 12 mois', ${PLANS[plan].priceAnnualFcf}, '${new Date(Date.now() + 30 * 86_400_000).toISOString()}')`,
      )
    }
    res.redirect(`/licenses/${encodeURIComponent(licenseId)}`)
  })

  router.post('/customers/:id/invoices', async (req: Req, res: Res) => {
    const b = req.body as Record<string, string>
    const amount = Number(b.amountFcf ?? 0)
    if (amount > 0) {
      const seqInv = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM invoices`)
      const invoiceNumber = `FAC-${new Date().getFullYear()}-${String(Number(seqInv[0]?.cnt ?? 0) + 1).padStart(4, '0')}`
      await dbh.exec(
        `INSERT INTO invoices (invoice_number, customer_id, label, amount_fcf, due_at)
         VALUES ('${invoiceNumber}', '${req.params.id}', '${(b.label ?? 'Prestation').replace(/'/g, "''")}', ${Math.round(amount)}, '${new Date(Date.now() + 30 * 86_400_000).toISOString()}')`,
      )
    }
    res.redirect(`/customers/${req.params.id}`)
  })

  /* Licences */
  router.get('/licenses', async (_req: Req, res: Res) => {
    const rows = await dbh.query<{ license_id: string; plan: string; status: string; expires_at: string | null; customer_name: string; instances: number }>(
      `SELECT l.license_id, l.plan, l.status, l.expires_at::text AS expires_at, c.name AS customer_name,
              (SELECT count(*) FROM license_activations a WHERE a.license_id = l.license_id AND a.status = 'active')::int AS instances
       FROM licenses l JOIN customers c ON c.id = l.customer_id ORDER BY l.created_at DESC`,
    )
    res.send(page('Licences', `<h1>Licences</h1>
      <table><tr><th>Licence</th><th>Client</th><th>Plan</th><th>Statut</th><th>Expire</th><th>Instances</th><th></th></tr>
      ${rows.map((l) => `<tr><td><b>${l.license_id}</b></td><td>${l.customer_name}</td><td>${l.plan}</td><td>${badge(l.status)}</td>
        <td>${l.expires_at ? new Date(l.expires_at).toLocaleDateString('fr-FR') : '—'}</td><td>${l.instances}</td>
        <td><a href="/licenses/${encodeURIComponent(l.license_id)}">Ouvrir</a></td></tr>`).join('')}
      </table>`))
  })

  router.get('/licenses/:licenseId', async (req: Req, res: Res) => {
    const licenseId = String(req.params.licenseId).replace(/'/g, "''")
    const l = (
      await dbh.query<{ license_id: string; status: string; plan: string; customer_name: string; expires_at: string | null; signature: string }>(
        `SELECT l.*, c.name AS customer_name FROM licenses l JOIN customers c ON c.id = l.customer_id WHERE l.license_id = '${licenseId}' ORDER BY l.created_at DESC LIMIT 1`,
      )
    )[0]
    if (!l) return res.status(404).send(page('Licence', '<h1>Introuvable</h1>'))
    const acts = await dbh.query<{ instance_id: string; status: string; version: string; mode: string; last_heartbeat_at: string | null }>(
      `SELECT instance_id, status, version, mode, last_heartbeat_at::text AS last_heartbeat_at FROM license_activations WHERE license_id = '${licenseId}'`,
    )
    const body = `<h1>${l.license_id}</h1><p>${badge(l.status)} · plan <b>${l.plan}</b> · ${l.customer_name}
      · expire ${l.expires_at ? new Date(l.expires_at).toLocaleDateString('fr-FR') : '—'}</p>
      <h2>Actions</h2>
      <form class="inline" method="post" action="/licenses/${encodeURIComponent(l.license_id)}/renew">
        <label>Renouveler (mois)<input name="months" type="number" value="12" min="1"></label><button type="submit">Renouveler</button>
      </form>
      <form class="inline" method="post" action="/licenses/${encodeURIComponent(l.license_id)}/revoke">
        <button type="submit">Révoquer la licence</button>
      </form>
      <h2>Fichier licence (.lic)</h2>
      <pre>${l.signature.slice(0, 400)}${l.signature.length > 400 ? '…' : ''}</pre>
      <h2>Instances activées</h2>
      <table><tr><th>Instance</th><th>Statut</th><th>Mode</th><th>Version</th><th>Dernier heartbeat</th><th></th></tr>
      ${acts.map((a) => `<tr><td class="muted">${a.instance_id}</td><td>${badge(a.status)}</td><td>${a.mode}</td><td>${a.version || '—'}</td>
        <td>${a.last_heartbeat_at ? new Date(a.last_heartbeat_at).toLocaleString('fr-FR') : '—'}</td>
        <td><form method="post" action="/instances/${encodeURIComponent(a.instance_id)}/reset"><button class="ghost" type="submit">Réinitialiser</button></form></td></tr>`).join('')}
      </table>`
    res.send(page(l.license_id, body))
  })

  router.post('/licenses/:licenseId/renew', async (req: Req, res: Res) => {
    const months = Math.max(1, Number((req.body as Record<string, string>).months ?? 12))
    const licenseId = String(req.params.licenseId).replace(/'/g, "''")
    const prev = (
      await dbh.query<{ license_id: string; customer_id: string; plan: string; expires_at: string | null; max_instances: number }>(
        `SELECT license_id, customer_id, plan, expires_at::text AS expires_at, max_instances FROM licenses WHERE license_id = '${licenseId}' ORDER BY created_at DESC LIMIT 1`,
      )
    )[0]
    if (prev) {
      const customer = (await dbh.query<{ name: string }>(`SELECT name FROM customers WHERE id = '${prev.customer_id}'`))[0]
      const base = prev.expires_at && new Date(prev.expires_at) > new Date() ? new Date(prev.expires_at) : new Date()
      const expiresAt = new Date(base.getTime() + months * 30 * 86_400_000).toISOString()
      const { issueLicenseFile } = await import('./signing.js')
      const signature = issueLicenseFile({
        licenseId: prev.license_id, organization: customer?.name ?? 'Client', plan: prev.plan as 'pilot' | 'business' | 'enterprise',
        issuedAt: new Date().toISOString(), expiresAt, entitlements: PLANS[prev.plan]?.entitlements ?? {},
      })
      await dbh.exec(`UPDATE licenses SET status = 'replaced' WHERE license_id = '${licenseId}' AND status = 'active'`)
      await dbh.exec(
        `INSERT INTO licenses (license_id, customer_id, plan, status, max_instances, expires_at, entitlements, signature)
         VALUES ('${licenseId}', '${prev.customer_id}', '${prev.plan}', 'active', ${prev.max_instances}, '${expiresAt}',
                 '${JSON.stringify(PLANS[prev.plan]?.entitlements ?? {}).replace(/'/g, "''")}'::jsonb, '${signature.replace(/'/g, "''")}')`,
      )
    }
    res.redirect(`/licenses/${encodeURIComponent(String(req.params.licenseId))}`)
  })

  router.post('/licenses/:licenseId/revoke', async (req: Req, res: Res) => {
    await dbh.exec(
      `UPDATE licenses SET status = 'revoked', revoked_at = now() WHERE license_id = '${String(req.params.licenseId).replace(/'/g, "''")}' AND status = 'active'`,
    )
    res.redirect(`/licenses/${encodeURIComponent(String(req.params.licenseId))}`)
  })

  /* Instances */
  router.get('/instances', async (_req: Req, res: Res) => {
    const rows = await dbh.query<{
      instance_id: string; license_id: string; status: string; version: string; mode: string;
      counts: Record<string, number> | null; last_heartbeat_at: string | null; customer_name: string
    }>(
      `SELECT a.instance_id, a.license_id, a.status, a.version, a.mode, a.counts, a.last_heartbeat_at::text AS last_heartbeat_at, c.name AS customer_name
       FROM license_activations a JOIN licenses l ON l.license_id = a.license_id JOIN customers c ON c.id = l.customer_id
       ORDER BY a.last_heartbeat_at DESC NULLS LAST`,
    )
    res.send(page('Instances', `<h1>Instances clientes</h1>
      <table><tr><th>Instance</th><th>Client</th><th>Licence</th><th>Statut</th><th>Mode</th><th>Usage</th><th>Heartbeat</th><th></th></tr>
      ${rows.map((a) => {
        const counts = (a.counts ?? {}) as Record<string, number>
        return `<tr><td class="muted">${a.instance_id}</td><td>${a.customer_name}</td><td>${a.license_id}</td><td>${badge(a.status)}</td><td>${badge(a.mode)}</td>
        <td class="muted">${counts.users ?? '—'} users · ${counts.agents ?? '—'} agents · ${counts.integrations ?? '—'} int.</td>
        <td>${a.last_heartbeat_at ? new Date(a.last_heartbeat_at).toLocaleString('fr-FR') : '—'}</td>
        <td><form method="post" action="/instances/${encodeURIComponent(String(a.instance_id))}/reset"><button class="ghost" type="submit">Réinitialiser</button></form></td></tr>`
      }).join('')}
      </table>`))
  })

  router.post('/instances/:instanceId/reset', async (req: Req, res: Res) => {
    await dbh.exec(
      `UPDATE license_activations SET status = 'deactivated' WHERE instance_id = '${String(req.params.instanceId).replace(/'/g, "''")}'`,
    )
    res.redirect('/instances')
  })

  /* Factures */
  router.get('/invoices', async (_req: Req, res: Res) => {
    const rows = await dbh.query<{ invoice_number: string; label: string; amount_fcf: string; status: string; customer_name: string }>(
      `SELECT i.invoice_number, i.label, i.amount_fcf, i.status, i.issued_at::text AS issued_at, c.name AS customer_name
       FROM invoices i JOIN customers c ON c.id = i.customer_id ORDER BY i.issued_at DESC`,
    )
    res.send(page('Factures', `<h1>Factures</h1>
      <table><tr><th>Facture</th><th>Client</th><th>Libellé</th><th>Montant</th><th>Statut</th><th></th></tr>
      ${rows.map((i) => `<tr><td><b>${i.invoice_number}</b></td><td>${i.customer_name}</td><td>${i.label}</td><td>${formatFcf(Number(i.amount_fcf))}</td><td>${badge(i.status)}</td>
        <td>${i.status !== 'paid' ? `<form method="post" action="/invoices/${encodeURIComponent(String(i.invoice_number))}/paid"><button type="submit">Marquer payée</button></form>` : ''}</td></tr>`).join('')}
      </table>`))
  })

  router.post('/invoices/:invoiceNumber/paid', async (req: Req, res: Res) => {
    const n = String(req.params.invoiceNumber).replace(/'/g, "''")
    const inv = (await dbh.query<{ id: string; amount_fcf: string }>(`SELECT id, amount_fcf::text AS amount_fcf FROM invoices WHERE invoice_number = '${n}' LIMIT 1`))[0]
    if (inv) {
      await dbh.exec(`INSERT INTO payments (invoice_id, amount_fcf) VALUES ('${inv.id}', ${inv.amount_fcf})`)
      await dbh.exec(`UPDATE invoices SET status = 'paid', paid_at = now() WHERE invoice_number = '${n}'`)
    }
    res.redirect('/invoices')
  })

  return router
}
