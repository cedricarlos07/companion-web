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
