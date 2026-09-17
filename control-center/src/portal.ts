import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router, json as expressJson, urlencoded } from 'express'
import type { Request, Response } from 'express'
import type { DbHandle } from './db.js'

/**
 * PORTAIL CLIENT — portal.companion.kamaloka.ai
 *
 * L'espace client : licences, téléchargements (URLs temporaires, accès lié à
 * une session authentifiée), factures, instances, releases, support.
 * Aucune donnée métier des installations clientes ne transite ici.
 */

const PORTAL_SECRET = process.env.CC_PORTAL_SECRET ?? 'kamaloka-portal-dev-secret'
const ASSETS_DIR = process.env.CC_RELEASE_ASSETS_DIR ?? path.resolve('portal-assets')
const TOKEN_TTL_S = 10 * 60

/* --------------------------- mots de passe -------------------------------- */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
}

/* ------------------------------ sessions ---------------------------------- */

function sign(payload: string): string {
  return crypto.createHmac('sha256', PORTAL_SECRET).update(payload).digest('base64url')
}

function makeSession(customerId: string): string {
  const exp = Date.now() + 12 * 3600 * 1000
  const payload = `${customerId}.${exp}`
  return `${payload}.${sign(payload)}`
}

function readSession(req: Request): string | null {
  const raw = typeof req.headers.cookie === 'string' ? req.headers.cookie : ''
  for (const part of raw.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k !== 'portal_session') continue
    const value = decodeURIComponent(rest.join('='))
    const idx = value.lastIndexOf('.')
    if (idx < 0) return null
    const payload = value.slice(0, idx)
    const sig = value.slice(idx + 1)
    const expected = sign(payload)
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
    const [customerId, exp] = payload.split('.')
    if (Number(exp) < Date.now()) return null
    return customerId
  }
  return null
}

export function portalCustomerId(req: Request): string | null {
  return readSession(req)
}

/* --------------------------- tokens download ------------------------------ */

export function makeDownloadToken(file: string): string {
  const exp = Date.now() + TOKEN_TTL_S * 1000
  const payload = `${file}.${exp}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

export function readDownloadToken(token: string): string | null {
  const dot = token.lastIndexOf('.')
  if (dot < 0) return null
  let payload: string
  try {
    payload = Buffer.from(token.slice(0, dot), 'base64url').toString()
  } catch {
    return null
  }
  const expected = sign(payload)
  const sig = token.slice(dot + 1)
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  const idx = payload.lastIndexOf('.')
  const file = payload.slice(0, idx)
  const exp = Number(payload.slice(idx + 1))
  if (!Number.isFinite(exp) || exp < Date.now()) return null
  return file
}

/* ------------------------------- router ----------------------------------- */

interface LicenseRow {
  license_id: string
  plan: string
  status: string
  expires_at: string | null
  entitlements: Record<string, unknown>
  signature: string
}

export function buildPortal(dbh: DbHandle): Router {
  const router = Router()
  router.use(urlencoded({ extended: false }))
  router.use(expressJson())

  /* Page de connexion HTML */
  router.get('/portal/login', (req: Request, res: Response) => {
    const hasError = Boolean((req.query as Record<string, unknown>).error)
    res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>KamaLoka — Portail client</title><style>
body{font:14px/1.5 system-ui,sans-serif;background:#f6f7f9;display:grid;place-items:center;min-height:100vh;margin:0}
.box{background:#fff;border:1px solid #e4e7ec;border-radius:14px;padding:32px;width:min(380px,90vw)}
h1{font-size:18px;margin:0 0 4px}p{color:#667085;margin:0 0 20px;font-size:13px}
label{display:block;font-size:12px;color:#475467;margin-bottom:10px}input{width:100%;box-sizing:border-box;border:1px solid #d0d5dd;border-radius:8px;padding:9px;font:inherit;margin-top:4px}
button{width:100%;background:#1849a9;color:#fff;border:0;border-radius:8px;padding:10px;font:inherit;cursor:pointer}
.err{color:#b42318;font-size:13px;margin-bottom:10px}</style></head><body>
<div class="box"><h1>Portail client KamaLoka</h1><p>Companion — licences, téléchargements et factures.</p>
${hasError ? '<p class="err">Identifiants invalides.</p>' : ''}
<form method="post" action="/portal/login"><label>Email<input name="email" type="email" required autofocus>
</label><label>Mot de passe<input name="password" type="password" required></label>
<button type="submit">Se connecter</button></form></div></body></html>`)
  })

  router.post('/portal/login', async (req: Request, res: Response) => {
    const { email, password } = req.body as Record<string, string>
    const user = (
      await dbh.query<{ id: string; customer_id: string; password_hash: string }>(
        `SELECT id, customer_id, password_hash FROM portal_users WHERE email = '${String(email ?? '').replace(/'/g, "''")}' LIMIT 1`,
      )
    )[0]
    if (!user || !verifyPassword(String(password ?? ''), user.password_hash)) {
      return res.redirect('/portal/login?error=1')
    }
    res.setHeader('set-cookie', `portal_session=${makeSession(user.customer_id)}; Path=/; HttpOnly; SameSite=Lax`)
    res.redirect('/portal')
  })

  router.post('/portal/logout', (_req: Request, res: Response) => {
    res.setHeader('set-cookie', 'portal_session=; Path=/; Max-Age=0')
    res.redirect('/portal/login')
  })

  /* ------------------------- API JSON du portail ------------------------- */

  router.use(['/portal/api', '/portal'], (req: Request, res: Response, next: () => void) => {
    if (req.path.startsWith('/login') || req.method === 'POST' && req.path === '/logout') return next()
    if (!readSession(req)) return res.status(401).json({ error: 'connexion requise' })
    next()
  })

  async function activeLicense(customerId: string): Promise<LicenseRow | undefined> {
    return (
      await dbh.query<LicenseRow>(
        `SELECT license_id, plan, status, expires_at::text AS expires_at, entitlements, signature
         FROM licenses WHERE customer_id = '${customerId}' AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
      )
    )[0]
  }

  router.get('/portal/api/overview', async (req: Request, res: Response) => {
    const customerId = readSession(req)!
    const customer = (await dbh.query<{ name: string; contact_email: string }>(`SELECT name, contact_email FROM customers WHERE id = '${customerId}' LIMIT 1`))[0]
    const lic = await activeLicense(customerId)
    const invoices = await dbh.query<{ invoice_number: string; label: string; amount_fcf: string; status: string; issued_at: string; due_at: string | null }>(
      `SELECT invoice_number, label, amount_fcf::text AS amount_fcf, status, issued_at::text AS issued_at, due_at::text AS due_at
       FROM invoices WHERE customer_id = '${customerId}' ORDER BY issued_at DESC`,
    )
    const instances = lic
      ? await dbh.query<{ instance_id: string; status: string; version: string; mode: string; last_heartbeat_at: string | null; counts: Record<string, number> | null }>(
          `SELECT instance_id, status, version, mode, last_heartbeat_at::text AS last_heartbeat_at, counts
           FROM license_activations WHERE license_id = '${lic.license_id}' ORDER BY last_heartbeat_at DESC NULLS LAST`,
        )
      : []
    const latest = (
      await dbh.query<{ version: string; channel: string; notes: string; published_at: string }>(
        `SELECT version, channel, notes, published_at::text AS published_at FROM releases WHERE channel = 'stable' ORDER BY published_at DESC LIMIT 1`,
      )
    )[0]
    const installedVersion = instances.find((i) => i.version)?.version ?? null
    res.json({
      customer: customer ?? null,
      license: lic
        ? {
            licenseId: lic.license_id, plan: lic.plan, expiresAt: lic.expires_at,
            entitlements: lic.entitlements,
            expired: lic.expires_at ? new Date(lic.expires_at) < new Date() : false,
          }
        : null,
      installedVersion,
      latestRelease: latest ?? null,
      updateAvailable: Boolean(latest && installedVersion && latest.version !== installedVersion),
      instances,
      invoices: invoices.map((i) => ({ ...i, amountFcf: Number(i.amount_fcf) })),
    })
  })

  /** Téléchargement du fichier licence .lic — client connecté uniquement. */
  router.get('/portal/api/license.lic', async (req: Request, res: Response) => {
    const lic = await activeLicense(readSession(req)!)
    if (!lic) return res.status(404).json({ error: 'aucune licence active' })
    res.setHeader('content-type', 'application/octet-stream')
    res.setHeader('content-disposition', `attachment; filename="companion-license-${lic.license_id.toLowerCase()}.lic"`)
    res.send(lic.signature)
  })

  router.get('/portal/api/releases', async (_req: Request, res: Response) => {
    const rows = await dbh.query<{ version: string; channel: string; notes: string; minimum_version: string; published_at: string }>(
      `SELECT version, channel, notes, minimum_version, published_at::text AS published_at FROM releases ORDER BY published_at DESC`,
    )
    res.json({ releases: rows })
  })

  /** Lien de téléchargement temporaire (10 min) pour un fichier de release. */
  router.post('/portal/api/download-link', async (req: Request, res: Response) => {
    readSession(req)!
    const { file } = req.body as { file?: string }
    if (!file || file.includes('..') || file.includes('/')) return res.status(400).json({ error: 'fichier invalide' })
    if (!fs.existsSync(path.join(ASSETS_DIR, file))) return res.status(404).json({ error: 'fichier indisponible' })
    const token = makeDownloadToken(file)
    res.json({ url: `/dl/${encodeURIComponent(token)}`, expiresInS: TOKEN_TTL_S })
  })

  /** Distribution : fichier servi uniquement avec un token valide et court. */
  router.get('/dl/:token', (req: Request, res: Response) => {
    const file = readDownloadToken(String(req.params.token))
    if (!file) return res.status(403).send('Lien expiré ou invalide — reconnectez-vous au portail.')
    const full = path.join(ASSETS_DIR, file)
    if (!fs.existsSync(full)) return res.status(404).send('Fichier indisponible.')
    res.setHeader('content-disposition', `attachment; filename="${path.basename(file)}"`)
    res.sendFile(full)
  })

  /* ------------------------------ UI portail ------------------------------ */

  router.get('/portal', async (req: Request, res: Response) => {
    const customerId = readSession(req)
    if (!customerId) return res.redirect('/portal/login')
    const customer = (await dbh.query<{ name: string }>(`SELECT name FROM customers WHERE id = '${customerId}' LIMIT 1`))[0]
    const lic = await activeLicense(customerId)
    const latest = (
      await dbh.query<{ version: string }>(`SELECT version FROM releases WHERE channel = 'stable' ORDER BY published_at DESC LIMIT 1`)
    )[0]
    const installed = (
      await dbh.query<{ version: string | null }>(
        `SELECT (SELECT version FROM license_activations WHERE license_id = '${lic?.license_id ?? ''}' ORDER BY last_heartbeat_at DESC NULLS LAST LIMIT 1) AS version`,
      )
    )[0]
    const portalStyle = `<style>
body{font:14px/1.5 system-ui,sans-serif;background:#f6f7f9;margin:0;color:#1a1d21}
header{background:#101828;color:#fff;padding:12px 24px;display:flex;gap:16px;align-items:center}
header .brand{font-weight:700}header a{color:#cbd5e1;text-decoration:none;margin-right:12px}header a:hover{color:#fff}
main{max-width:960px;margin:24px auto;padding:0 16px}
h1{font-size:20px}h2{font-size:15px;margin:26px 0 8px}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:18px}
.card{background:#fff;border:1px solid #e4e7ec;border-radius:12px;padding:16px}
.card b{display:block;font-size:18px;margin-bottom:2px}.card span{color:#667085;font-size:12px}
table{width:100%;border-collapse:collapse;background:#fff;border:1px solid #e4e7ec;border-radius:10px;overflow:hidden}
th,td{text-align:left;padding:9px 12px;border-bottom:1px solid #eef0f3;font-size:13px}th{background:#f9fafb;color:#475467}
.badge{border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
.ok{background:#dcfae6;color:#067647}.warn{background:#fef0c7;color:#b54708}.bad{background:#fee4e2;color:#b42318}.mute{background:#eef2f6;color:#475467}
button{background:#1849a9;color:#fff;border:0;border-radius:8px;padding:8px 14px;font:inherit;cursor:pointer}
button.ghost{background:#eef2f6;color:#1a1d21}
code{background:#eef2f6;border-radius:6px;padding:2px 6px;font-size:12px}
.msg{background:#eff6ff;border:1px solid #bfd8ff;color:#1849a9;border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:13px}
ul.assets{list-style:none;padding:0;display:grid;gap:8px}
ul.assets li{background:#fff;border:1px solid #e4e7ec;border-radius:10px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center}
</style>`
    const body = `<header><span class="brand">KAMALOKA · Portail client</span>
<nav><a href="/docs" target="_blank">Documentation</a><a href="mailto:support@kamaloka.ai">Support</a></nav>
<form method="post" action="/portal/logout" style="margin-left:auto"><button class="ghost" type="submit">Déconnexion</button></form></header>
<main>
<h1>Bonjour ${customer?.name ?? '—'}</h1>
${lic && lic.expires_at && new Date(lic.expires_at) < new Date() ? '<div class="msg">Votre licence a expiré — consultez la rubrique Renouvellement ou contactez votre interlocuteur Kamaloka.</div>' : ''}
${latest && installed?.version && latest.version !== installed.version ? `<div class="msg">Une mise à jour est disponible : Companion ${installed.version} → <b>${latest.version}</b>. Aucune mise à jour n'est appliquée automatiquement.</div>` : ''}

<h2>Votre licence</h2>
<div class="cards">
  <div class="card"><b>${lic ? lic.plan.charAt(0).toUpperCase() + lic.plan.slice(1) : '—'}</b><span>Plan</span></div>
  <div class="card"><b>${lic ? (lic.expires_at ? new Date(lic.expires_at).toLocaleDateString('fr-FR') : '—') : '—'}</b><span>Expire le</span></div>
  <div class="card"><b>${installed?.version ?? '—'}</b><span>Version installée</span></div>
  <div class="card"><b>${latest?.version ?? '—'}</b><span>Dernière version (stable)</span></div>
</div>

<h2>Téléchargements</h2>
<ul class="assets" id="assets">
  <li><span><code>install.sh</code> — installation automatisée (Ubuntu 24.04, Docker)</span><button data-file="install.sh">Télécharger</button></li>
  <li><span><code>docker-compose.prod.yml</code> — stack complète (PostgreSQL, Redis, Activepieces)</span><button data-file="docker-compose.prod.yml">Télécharger</button></li>
  <li><span><code>.env.example</code> — configuration</span><button data-file=".env.example">Télécharger</button></li>
  <li><span><code>checksums.sha256</code> — vérification d'intégrité</span><button data-file="checksums.sha256">Télécharger</button></li>
</ul>
<p style="font-size:12px;color:#667085">Chaque téléchargement génère un lien temporaire valable 10 minutes, lié à votre session.</p>

<h2>Fichier licence</h2>
<p><a href="/portal/api/license.lic"><button type="button">Télécharger companion-license.lic</button></a></p>
${lic ? `<p style="font-size:13px;color:#475467">${lic.license_id} · ${Object.entries(lic.entitlements).filter(([k]) => k.endsWith('.max')).map(([k, v]) => `${String(v)} ${k.replace('.max', '')}`).join(' · ')}</p>` : ''}

<h2>Factures</h2>
<table><tr><th>Facture</th><th>Libellé</th><th>Montant</th><th>Statut</th></tr>
${(await dbh.query<{ invoice_number: string; label: string; amount_fcf: string; status: string }>(
      `SELECT invoice_number, label, amount_fcf::text AS amount_fcf, status FROM invoices WHERE customer_id = '${customerId}' ORDER BY issued_at DESC`,
    )).map((i) => `<tr><td><b>${i.invoice_number}</b></td><td>${i.label}</td><td>${Number(i.amount_fcf).toLocaleString('fr-FR')} FCFA</td>
<td><span class="badge ${i.status === 'paid' ? 'ok' : 'warn'}">${i.status === 'paid' ? 'Payée' : 'En attente'}</span></td></tr>`).join('')}
</table>

<h2>Instances activées</h2>
<table><tr><th>Instance</th><th>Mode</th><th>Version</th><th>Utilisateurs</th><th>Dernier contact</th></tr>
${(await dbh.query<{ instance_id: string; mode: string; version: string; counts: Record<string, number> | null; last_heartbeat_at: string | null }>(
      `SELECT instance_id, mode, version, counts, last_heartbeat_at::text AS last_heartbeat_at
       FROM license_activations WHERE license_id = '${lic?.license_id ?? ''}' ORDER BY last_heartbeat_at DESC NULLS LAST`,
    )).map((i) => `<tr><td><code>${i.instance_id}</code></td><td>${i.mode}</td><td>${i.version || '—'}</td>
<td>${i.counts?.users ?? '—'} / ${(lic?.entitlements?.['users.max'] as number) ?? '—'}</td>
<td>${i.last_heartbeat_at ? new Date(i.last_heartbeat_at).toLocaleString('fr-FR') : '—'}</td></tr>`).join('')}
</table>

<h2>Renouvellement & support</h2>
<p style="font-size:13px;color:#475467">Renouvellement : contactez votre interlocuteur Kamaloka — une nouvelle licence est émise après paiement, sans interruption de service.
Support Business : <a href="mailto:support@kamaloka.ai">support@kamaloka.ai</a> · Documentation : <a href="/docs" target="_blank">docs.companion.kamaloka.ai</a></p>
</main>
<script>
document.querySelectorAll('#assets button').forEach(function (b) {
  b.addEventListener('click', async function () {
    b.disabled = true
    try {
      const r = await fetch('/portal/api/download-link', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ file: b.dataset.file }) })
      const d = await r.json()
      if (d.url) { location.href = d.url } else { alert(d.error ?? 'Indisponible') }
    } finally { b.disabled = false }
  })
})
</script>`
    res.send(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KamaLoka — Portail client</title>${portalStyle}</head>${body}</html>`)
  })

  return router
}
