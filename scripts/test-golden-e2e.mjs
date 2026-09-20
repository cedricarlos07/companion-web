/**
 * GOLDEN E2E — le cycle externe complet contre une instance RÉELLE.
 *
 * Chaîne vérifiée :
 *   Activepieces webhook (contrat « Drive → Companion ») → ingestion complète
 *   → mémoires → Ask avec citation → run Mastra (relance) → approval humaine
 *   → envoi (send_email) → audit de bout en bout.
 *
 * Cible : instance déjà provisionnée (VPS via deploy.sh, ou dev :5299 avec
 * seed). Aucun serveur n'est démarré ici — on teste l'instance telle qu'elle
 * tourne, comme un système externe.
 *
 * Jambes OAuth externes (Drive/Gmail réels via Activepieces) : exécutées
 * seulement si ACTIVEPIECES_URL + ACTIVEPIECES_MCP_TOKEN sont fournis ;
 * sinon elles sont annoncées SKIP (jamais silencieuses).
 *
 * Usage :
 *   GOLDEN_BASE_URL=http://localhost:5299 node scripts/test-golden-e2e.mjs
 *   GOLDEN_WEBHOOK_SECRET=...          # réutilise un secret déjà posé
 *   ACTIVEPIECES_URL=... ACTIVEPIECES_MCP_TOKEN=...  # jambes OAuth réelles
 */
const BASE = process.env.GOLDEN_BASE_URL ?? 'http://localhost:5299'
const stamp = Date.now()
let cookie = ''

let pass = 0
const failures = []
const skips = []
const step = (name, ok, detail = '') => {
  if (ok) pass++
  else failures.push(name)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` → ${detail}` : ''}`)
}
const skip = (name, why) => {
  skips.push(name)
  console.log(`⏭️  ${name} — SKIP : ${why}`)
}

async function api(path, { method = 'GET', body, headers } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(headers ?? {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

console.log(`━━ Golden E2E contre ${BASE}`)

/* 0. Instance joignable */
const status = await api('/status')
if (status.status !== 200) {
  console.error(`💥 instance injoignable (${status.status}) — démarrez-la (deploy.sh ou npm run dev:server).`)
  process.exit(1)
}
step('0. instance joignable', true, `moteur mémoire: ${status.data?.engine ?? '?'}`)

/* 1. Login owner */
const login = await api('/auth/login', { method: 'POST', body: { email: 'ange.niamke@kamaloka.ci', password: 'companion' } })
step('1. login owner', login.status === 200)
if (login.status !== 200) {
  console.error('Impossible de continuer sans session owner.')
  process.exit(1)
}

/* 2. Secret du webhook (contrat Activepieces → Companion) */
let secret = process.env.GOLDEN_WEBHOOK_SECRET
if (!secret) {
  const res = await api('/ap/webhook-secret', { method: 'POST' })
  if (res.status === 200 && res.data?.secret) secret = res.data.secret
}
step('2. secret webhook provisionné (POST /ap/webhook-secret)', Boolean(secret))

/* 3. Jambe « Drive » : webhook Activepieces si l'instance l'a activé,
 *    sinon ingestion locale (même pipeline aval, provenance étiquetée). */
const apHealth = await api('/integrations/activepieces/health')
const apEnabledHere = apHealth.data?.enabled === true && apHealth.data?.ok === true
const docTitle = `procédure-golden-${stamp}`
const goldenContent = `Procédure Golden ${stamp} : toute commande urgente chez Sotra Golden doit être confirmée par écrit auprès du dispatcher régional avec un délai de confirmation de deux heures ouvrées avant engagement du transport. Le règlement se fait à trente jours fin de mois.`
let docId = null
if (apEnabledHere && secret) {
  const push = await fetch(`${BASE}/api/ap/webhooks/activepieces/file`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${secret}` },
    body: JSON.stringify({
      fileName: `${docTitle}.txt`,
      sourceName: 'Google Drive (golden)',
      mimeType: 'txt',
      content: goldenContent,
    }),
  })
  const pushBody = await push.json().catch(() => null)
  docId = pushBody?.documentId ?? null
  step('3. webhook Activepieces accepte le fichier (contrat Drive)', push.status === 200 && Boolean(docId), docId ?? String(push.status))
} else {
  skip('3. webhook Activepieces (contrat Drive)', "Activepieces non activé sur l'instance — ingestion locale équivalente utilisée.")
  const up = new FormData()
  up.append('text', goldenContent)
  up.append('title', docTitle)
  up.append('sourceName', 'Golden E2E (local)')
  const upload = await fetch(`${BASE}/api/sources/upload`, {
    method: 'POST', credentials: 'include', headers: { cookie }, body: up,
  })
  const uploadBody = await upload.json().catch(() => null)
  docId = uploadBody?.documents?.[0]?.id ?? null
  step('3b. ingestion locale du même contenu (POST /sources/upload)', upload.status === 200 && Boolean(docId), docId ?? String(upload.status))
}

/* 4. Ingestion complète (extract → chunk → embed → candidates) */
let doc = null
for (let i = 0; i < 90; i++) {
  await new Promise((r) => setTimeout(r, 2000))
  const docs = await api('/sources')
  doc = (docs.data?.documents ?? []).find((d) => d.id === docId || d.title === `${docTitle}.txt`)
  if (doc && doc.status === 'done') break
}
step('4. ingestion terminée (document done)', doc?.status === 'done', doc ? `status=${doc.status}` : 'document introuvable')

/* 5. Ask cite la connaissance issue du webhook */
const ask = await api('/ask', {
  method: 'POST',
  body: { question: `Quel est le délai de confirmation pour une commande urgente chez Sotra Golden ${stamp} ?` },
})
const cited = (ask.data?.citations ?? []).some((c) => String(c.title ?? '').includes('Golden'))
step(
  '5. Ask répond avec citation de la connaissance ingérée',
  Boolean(ask.data?.answer) && cited,
  `citations=${(ask.data?.citations ?? []).length}`,
)

/* 6. Mastra : run agent (relance) → attente d'approbation */
const agents = await api('/agents')
const assistant = (agents.data?.agents ?? []).find((a) => a.key === 'company-assistant')
const run = await api(`/agents/${assistant?.id}/runs`, {
  method: 'POST',
  body: {
    skill: 'draft_followup',
    goal: `Golden E2E ${stamp}`,
    inputData: { client: 'Sotra Golden', goal: `relance golden ${stamp}` },
  },
})
const runId = run.data?.run?.id
step('6. run Mastra démarré (relance client)', Boolean(runId), `run ${String(runId ?? '').slice(0, 8)}`)

let runStatus = ''
for (let i = 0; i < 30; i++) {
  await new Promise((r) => setTimeout(r, 2000))
  const detail = await api(`/runs/${runId}`)
  runStatus = String(detail.data?.run?.status ?? '')
  if (runStatus === 'waiting_approval' || runStatus === 'completed' || runStatus === 'failed') break
}
step('7. workflow suspendu en attente d\'approbation humaine', runStatus === 'waiting_approval', `status=${runStatus}`)

/* 8. Approval → reprise → envoi */
if (runStatus === 'waiting_approval') {
  const approvals = await api('/approvals')
  const pending = (approvals.data?.approvals ?? []).find((a) => a.run_id === runId && a.status === 'pending')
  const approve = await api(`/approvals/${pending?.id}/approve`, { method: 'POST' })
  step('8. approbation humaine enregistrée', approve.status === 200)
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    const detail = await api(`/runs/${runId}`)
    runStatus = String(detail.data?.run?.status ?? '')
    if (runStatus === 'completed' || runStatus === 'failed') break
  }
  step('9. run complété après approbation (envoi exécuté)', runStatus === 'completed', `status=${runStatus}`)
} else {
  step('8. approbation humaine enregistrée', false, `statut inattendu: ${runStatus}`)
  step('9. run complété après approbation (envoi exécuté)', false)
}

/* 10. Audit de bout en bout */
const audit = await api('/audit')
const events = (audit.data?.events ?? []).map((e) => String(e.action))
const sawUpload = events.includes('source.uploaded') || events.includes('memory.created')
const sawRun = events.includes('agent.run_started')
const sawApproval = events.includes('approval.granted')
step('10. audit complet (upload + run + approbation)', sawUpload && sawRun && sawApproval,
  `upload=${sawUpload} run=${sawRun} approval=${sawApproval}`)

/* Jambes OAuth externes — seulement si Activepieces est configuré. */
const apUrl = process.env.ACTIVEPIECES_URL
const apToken = process.env.ACTIVEPIECES_MCP_TOKEN
if (apUrl && apToken) {
  const health = await api('/integrations/activepieces/health')
  step('11. Activepieces externe opérationnel (OAuth Drive/Gmail possibles)', health.data?.enabled === true && health.data?.ok === true)
} else {
  skip('11. Activepieces externe (OAuth Drive/Gmail réels)', 'ACTIVEPIECES_URL / ACTIVEPIECES_MCP_TOKEN non fournis — les jambes OAuth (compte Google) ne peuvent pas s\'exécuter ici.')
}

console.log('\n━━━━━━━ SYNTHÈSE GOLDEN E2E ━━━━━━━')
console.log(`✅ ${pass} vérification(s) passée(s)`)
if (skips.length > 0) for (const sname of skips) console.log(`⏭️  SKIP : ${sname}`)
if (failures.length === 0) {
  console.log('🏆 GOLDEN E2E : cycle externe complet vérifié.')
  process.exit(0)
}
console.error(`💥 GOLDEN E2E : ${failures.length} échec(s)`)
for (const f of failures) console.error(`   - ${f}`)
process.exit(1)
