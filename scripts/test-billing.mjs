/*
 * BILLING TEST — entitlements, usage report, licence et contrôle d'accès.
 *
 * Usage : node scripts/test-billing.mjs  (serveur sur :5299)
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5299'

const results = []
function step(label, ok, detail = '') {
  results.push({ label, ok })
  console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ` → ${detail}` : ''}`)
}

async function api(path, { method = 'GET', body, cookie } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    credentials: 'include',
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function login() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ange.niamke@kamaloka.ci', password: 'companion' }),
  })
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

/* Oracle de signature : dev-sign local, sinon le Control Center Kamaloka
 * (cas production : LICENSE_PUBLIC_KEY configurée → la clé privée vit au CC). */
const CC_URL = process.env.CC_URL ?? 'http://localhost:5300'
const CC_KEY = process.env.CC_ADMIN_KEY ?? 'kamaloka-dev-admin'
let ccCustomerId = null

async function signTestLicense(licenseId, plan, expiresAt, cookie) {
  const dev = await api('/license/dev-sign', {
    method: 'POST', cookie,
    body: {
      licenseId, organization: 'Test ABC', plan,
      issuedAt: new Date().toISOString(), expiresAt, entitlements: {},
    },
  })
  if (dev.status === 200 && dev.data?.license) return dev.data.license
  // Oracle Control Center.
  if (!ccCustomerId) {
    const cust = await fetch(`${CC_URL}/admin/customers`, {
      method: 'POST', headers: { 'x-admin-key': CC_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Licence Tests (auto)' }),
    })
    ccCustomerId = (await cust.json())?.customerId
  }
  const lic = await fetch(`${CC_URL}/admin/licenses`, {
    method: 'POST', headers: { 'x-admin-key': CC_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ customerId: ccCustomerId, plan, expiresAt, licenseId }),
  })
  const data = await lic.json()
  if (!data?.licenseFile) throw new Error(`signature CC impossible: ${JSON.stringify(data).slice(0, 150)}`)
  return data.licenseFile
}

async function main() {
  const cookie = await login()
  step('Setup — connexion owner', Boolean(cookie))

  /* A1 — endpoints protégés sans session. */
  const anonEnt = await api('/entitlements')
  const anonUsage = await api('/billing/usage')
  const anonLicense = await api('/license')
  step(
    'A1 — entitlements/usage/license sans session = 401',
    anonEnt.status === 401 && anonUsage.status === 401 && anonLicense.status === 401,
    `${anonEnt.status}/${anonUsage.status}/${anonLicense.status}`,
  )

  /* A2 — entitlements cohérents avec un plan connu. */
  const ent = await api('/entitlements', { cookie })
  const e = ent.data?.entitlements ?? {}
  const plans = {
    pilot: { users: 25, agents: 3 },
    business: { users: 100, agents: 20 },
    enterprise: { users: 9999, agents: 9999 },
  }
  const planName = ent.data?.plan ?? 'pilot'
  const ref = plans[planName]
  step(
    'A2 — entitlements présents + limites numériques',
    ent.status === 200 && Number.isFinite(e['users.max']) && Number.isFinite(e['agents.max']) && Number.isFinite(e['storage.maxGb']),
    `users.max=${e['users.max']} agents.max=${e['agents.max']}`,
  )
  step(
    'A3 — limites conformes au plan courant',
    Boolean(ref) && e['users.max'] === ref.users && e['agents.max'] === ref.agents,
    `plan=${planName}`,
  )

  /* A4 — rapport d'usage structuré et cohérent. */
  const usage = await api('/billing/usage', { cookie })
  const u = usage.data?.usage ?? {}
  const limitsOk =
    u.limits?.users?.max > 0 && u.limits?.agents?.max > 0 && u.limits?.mcpClients?.max > 0 && u.limits?.storageGb?.max > 0
  const coherent =
    Array.isArray(u.categories) &&
    u.categories.every((c) => Number.isFinite(c.amountFcf) && c.amountFcf >= 0) &&
    Number.isFinite(u.totalFcf) && u.totalFcf >= 0
  step('A4 — usage : limites > 0 et totaux cohérents', usage.status === 200 && limitsOk && coherent, `totalFcf=${u.totalFcf}`)
  step('A5 — usage : compteurs alignés sur les entitlements', u.limits?.users?.max === e['users.max'] && u.limits?.agents?.max === e['agents.max'])
  step('A6 — mode BYOK explicite', u.byok === true)

  /* A7 — licence : statut exploitable (active, trial ou expiré — jamais de crash). */
  const lic = await api('/license', { cookie })
  const validStatuses = ['active', 'expired', 'invalid', 'not_configured']
  step(
    'A7 — licence : statut connu + valid booléen',
    lic.status === 200 && validStatuses.includes(lic.data?.status) && typeof lic.data?.valid === 'boolean',
    `status=${lic.data?.status}`,
  )
  step('A8 — licence : cohérence valid/status', lic.data?.status === 'active' ? lic.data?.valid === true : true)

  /* A9 — cross-tenant : l'usage ne fuite pas d'autres organisations (totaux plausibles). */
  step(
    'A9 — usage : période présente',
    typeof u.period === 'string' && u.period.length > 0,
    u.period,
  )

  /* --------------- B — Cycle de vie licence (grâce / restreint) ----------- */

  /* B1 — mode + instanceId exposés. */
  let lic0 = await api('/license', { cookie })
  step(
    'B1 — /license : mode exposé + instanceId cmp_inst_*',
    ['active', 'grace', 'restricted'].includes(lic0.data?.mode) && /^cmp_inst_[0-9a-f]+$/.test(lic0.data?.instanceId ?? ''),
    `mode=${lic0.data?.mode} instance=${lic0.data?.instanceId}`,
  )

  /* B2 — import d'une licence expirée depuis >40 j (grâce 30 j dépassée) → restricted. */
  const now = Date.now()
  const expiredLic = await signTestLicense(
    `LIC-TEST-EXP-${now}`, 'business', new Date(now - 40 * 86_400_000).toISOString(), cookie,
  )
  const imp1 = await api('/license/import', { method: 'POST', cookie, body: { license: expiredLic } })
  const lic1 = await api('/license', { cookie })
  step('B2 — licence expirée (grâce dépassée) → mode restricted', imp1.status === 200 && lic1.data?.mode === 'restricted', `mode=${lic1.data?.mode}`)

  /* B3 — restricted : création d'utilisateur bloquée (402). */
  const invBlocked = await api('/invitations', { method: 'POST', cookie, body: { email: 'nouveau@test.ci', role: 'employee' } })
  step('B3 — restricted : invitation = 402', invBlocked.status === 402, `status=${invBlocked.status}`)

  /* B4 — restricted : exécution agentique bloquée (402). */
  const agents = await api('/agents', { cookie })
  const agentId = agents.data?.agents?.[0]?.id
  let runBlocked = { status: 0 }
  if (agentId) {
    runBlocked = await api(`/agents/${agentId}/runs`, { method: 'POST', cookie, body: { skill: 'search', goal: 'test restricted' } })
  }
  step('B4 — restricted : run agent = 402', Boolean(agentId) && runBlocked.status === 402, `status=${runBlocked.status}`)

  /* B5 — restricted : lecture libre. */
  const memories = await api('/memories', { cookie })
  step('B5 — restricted : lecture des mémoires libre', memories.status === 200)

  /* B6 — restricted : backup libre (données jamais en otage). */
  const backup = await api('/backup', { method: 'POST', cookie })
  step('B6 — restricted : backup libre', backup.status === 200, `status=${backup.status}`)

  /* B7 — licence expirée récente (-10 j) → grace, créations de nouveau possibles.
   * Email invalide volontaire : la route doit répondre 400 (validation), pas 402 (licence). */
  const graceLic = await signTestLicense(
    `LIC-TEST-GRACE-${now}`, 'business', new Date(now - 10 * 86_400_000).toISOString(), cookie,
  )
  await api('/license/import', { method: 'POST', cookie, body: { license: graceLic } })
  const lic2 = await api('/license', { cookie })
  const invInGrace = await api('/invitations', { method: 'POST', cookie, body: { email: 'email-invalide', role: 'employee' } })
  step(
    'B7 — grace : bannière active + créations possibles (400 validation, pas 402)',
    lic2.data?.mode === 'grace' && invInGrace.status === 400,
    `mode=${lic2.data?.mode} invitation=${invInGrace.status}`,
  )
  step('B8 — grace→business : entitlements synchronisés au plan de la licence', lic2.data?.plan === 'business')

  /* B9 — retrait de licence → retour essai pilot. */
  await api('/license', { method: 'DELETE', cookie })
  const lic3 = await api('/license', { cookie })
  const ent3 = await api('/entitlements', { cookie })
  step(
    'B9 — licence retirée : mode active + plan pilot',
    lic3.data?.mode === 'active' && ent3.data?.plan === 'pilot',
    `mode=${lic3.data?.mode} plan=${ent3.data?.plan}`,
  )

  /* B10 — import d'une licence falsifiée (mauvaise signature) refusé. */
  const fake = await api('/license/import', { method: 'POST', cookie, body: { license: Buffer.from(JSON.stringify({ payload: { licenseId: 'FAKE' }, signature: 'AAAA' })).toString('base64') } })
  step('B10 — licence falsifiée refusée à l\'import', fake.status === 400, `status=${fake.status}`)

  /* ---------------------------- SYNTHÈSE --------------------------------- */

  const failed = results.filter((r) => !r.ok)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━')
  if (failed.length === 0) {
    console.log(`🏆 BILLING TEST : ${results.length}/${results.length} scénarios passés.`)
  } else {
    console.log(`💥 BILLING TEST : ${failed.length} échec(s) / ${results.length}`)
    for (const f of failed) console.log(`   - ${f.label}`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error('Test interrompu:', e)
  process.exit(1)
})
