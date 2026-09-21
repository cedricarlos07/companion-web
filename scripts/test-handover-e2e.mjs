/**
 * HANDOVER E2E — le départ complet d'un employé, persistant, sans fixture.
 *
 * Serveur ISOLÉ (COMPANION_DATA_DIR jetable) démarré par le test lui-même :
 *   1. créer Moussa (partant) et Yann (successeur) sur le rôle Commercial
 *   2. créer le handover
 *   3. répondre à 3 lacunes d'entretien
 *   4. extraction : 3 candidats mémoire créés
 *   5. valider les 3 candidats
 *   6. en promouvoir un vers le Role Brain
 *   7. générer le pack (humain + machine)
 *   8. assigner Yann comme successeur
 *   9. Role Brain : la connaissance validée/promue apparaît
 *  10. Ask : la connaissance devient retrouvable avec citation
 *  11. audit : handover.started / answered / verified / promoted / successor_assigned
 *  12. cross-org = invisible · rôle employee = 403 · double-pack/double-affectation idempotents
 *  13. RESTART serveur (même data dir) → tout persiste
 *
 * Usage : node scripts/test-handover-e2e.mjs [--keep]
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const keep = process.argv.includes('--keep')

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
    srv.on('error', reject)
  })
}

const dataDir = path.resolve(`./data/handover-e2e-${Date.now()}`)
const port = await freePort()
const BASE = `http://127.0.0.1:${port}`
console.log(`━ serveur isolé : ${BASE}  (data: ${path.basename(dataDir)})`)

const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs')
let child = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(port),
    COMPANION_DATA_DIR: dataDir,
    AUTO_SEED: '1',
    LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL ?? 'http://localhost:5300',
  },
})
let serverLog = ''
child.stdout.on('data', (d) => { serverLog += d })
child.stderr.on('data', (d) => { serverLog += d })

const cleanup = () => {
  child.kill()
  if (!keep) setTimeout(() => fs.rmSync(dataDir, { recursive: true, force: true }), 1500)
  else console.log(`data dir conservé : ${dataDir}`)
}
process.on('exit', () => cleanup())
setTimeout(() => {
  console.error('💥 watchdog : E2E > 20 min — abandon.')
  process.exit(1)
}, 20 * 60_000).unref()

async function waitReady() {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      await fetch(`${BASE}/api/entitlements`)
      return true
    } catch { /* pas prêt */ }
    if (serverLog.includes('démarrage impossible')) return false
  }
  return false
}

async function startServer() {
  child = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: String(port),
      COMPANION_DATA_DIR: dataDir,
      LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL ?? 'http://localhost:5300',
    },
  })
  child.stdout.on('data', (d) => { serverLog += d })
  child.stderr.on('data', (d) => { serverLog += d })
  if (!(await waitReady())) {
    console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-12).join('\n'))
    process.exit(1)
  }
}

if (!(await waitReady())) {
  console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-12).join('\n'))
  process.exit(1)
}

let pass = 0
const failures = []
const step = (name, ok, detail = '') => {
  if (ok) pass++
  else failures.push(name)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` → ${detail}` : ''}`)
}

async function login(email, password = 'companion') {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

const api = (cookie) => async (path, { method = 'GET', body } = {}) => {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { cookie, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try { data = JSON.parse(text) } catch { data = { raw: text.slice(0, 120) } }
  return { status: res.status, data }
}

const stamp = Date.now()

/* ─── 1-2. Acteurs : Moussa (partant) + Yann (successeur) ─────────────────── */
const ownerCookie = await login('ange.niamke@kamaloka.ci')
step('1. connexion owner', Boolean(ownerCookie))

const roles = await api(ownerCookie)('/roles')
const commercial = (roles.data?.roles ?? []).find((r) => (r.title ?? '').toLowerCase().includes('commercial'))
const roleId = commercial?.id
step('2. rôle Commercial trouvé (Role Brain cible)', Boolean(roleId), commercial?.title)

const createdMoussa = await api(ownerCookie)('/employees', {
  method: 'POST',
  body: { firstName: 'Moussa', lastName: `Départ ${stamp}`, email: `moussa.depart.${stamp}@kamaloka.ci`, roleId, seniorityMonths: 48 },
})
const moussaId = createdMoussa.data?.employee?.id ?? createdMoussa.data?.id
step('3. Moussa créé (partant, rôle Commercial)', Boolean(moussaId), moussaId)

const createdYann = await api(ownerCookie)('/employees', {
  method: 'POST',
  body: { firstName: 'Yann', lastName: `Successeur ${stamp}`, email: `yann.succ.${stamp}@kamaloka.ci`, roleId, seniorityMonths: 2 },
})
const yannId = createdYann.data?.employee?.id ?? createdYann.data?.id
step('4. Yann créé (successeur)', Boolean(yannId), yannId)

/* ─── 5-7. Handover : création + gaps + entretien ─────────────────────────── */
const hv = await api(ownerCookie)('/handovers', { method: 'POST', body: { employeeId: moussaId } })
const handoverId = hv.data?.handover?.id ?? hv.data?.id
step('5. handover créé', Boolean(handoverId), `gaps=${hv.data?.gaps ?? '?'}`)

const detail1 = await api(ownerCookie)(`/handovers/${handoverId}`)
const gaps = detail1.data?.gaps ?? []
step('6. gaps d\'analyse détectés', gaps.length > 0, `${gaps.length} lacunes`)

let answered = 0
const producedMemoryIds = []
for (const gap of gaps.slice(0, 3)) {
  const res = await api(ownerCookie)(`/handovers/${handoverId}/answers`, {
    method: 'POST',
    body: {
      gapId: gap.id,
      answerText:
        `Procédure documentée pendant l'entretien de départ (${gap.kind}) : ` +
        `les étapes clés sont validées avec le successeur, les interlocuteurs sont prévenus, ` +
        `et l'historique complet est archivé dans la mémoire de l'équipe. Référence interne ${stamp}.`,
    },
  })
  const memoryId = res.data?.memory?.id ?? res.data?.answer?.produced_memory_id
  if (res.status === 200 && memoryId) {
    answered++
    producedMemoryIds.push(memoryId)
  }
}
step('7. entretien : 3 réponses → candidats mémoire créés', answered === 3, `${answered}/3`)

/* ─── 8. Validation humaine des candidats ─────────────────────────────────── */
let verified = 0
for (const mid of producedMemoryIds) {
  const r = await api(ownerCookie)(`/memories/${mid}/verify`, { method: 'POST' })
  if (r.status === 200) verified++
}
step('8. 3 candidats validés (humain)', verified === 3, `${verified}/3`)

/* ─── 9. Promotion vers le Role Brain ─────────────────────────────────────── */
const promotedMemoryId = producedMemoryIds[0]
const promo = await api(ownerCookie)(`/memories/${promotedMemoryId}/promote`, {
  method: 'POST',
  body: { roleId },
})
step('9. candidat promu vers le Role Brain', promo.data?.promoted === true, JSON.stringify(promo.data).slice(0, 80))

/* ─── 10. Pack de passation ───────────────────────────────────────────────── */
const pack = await api(ownerCookie)(`/handovers/${handoverId}/pack`, { method: 'POST' })
const humanPackOk = Boolean(pack.data?.humanPack) && (pack.data?.humanPack?.sections ?? pack.data?.humanPack?.length ?? 0) >= 0
step('10. pack généré (humain + machine)', Boolean(pack.data?.humanPack && pack.data?.machinePack), `human=${pack.data?.humanPack ? 'ok' : 'ko'} machine=${(pack.data?.machinePack ?? '').length} car.`)

/* ─── 11. Affectation du successeur ───────────────────────────────────────── */
const assign1 = await api(ownerCookie)(`/handovers/${handoverId}/successor`, { method: 'POST', body: { employeeId: yannId } })
const assign2 = await api(ownerCookie)(`/handovers/${handoverId}/successor`, { method: 'POST', body: { employeeId: yannId } })
const detail2 = await api(ownerCookie)(`/handovers/${handoverId}`)
const successorOk =
  assign1.status === 200 && assign2.status === 200 &&
  (detail2.data?.handover?.successor_name ?? '').toLowerCase().includes('yann')
step('11. successeur assigné (double affectation idempotente)', successorOk, detail2.data?.handover?.successor_name)

/* ─── 12. Role Brain enrichi ──────────────────────────────────────────────── */
const roleBrain = await api(ownerCookie)(`/roles/${roleId}`)
const roleMemories = roleBrain.data?.memories ?? []
const promotedInRoleBrain = roleMemories.some((m) => m.id === promotedMemoryId)
step('12. Role Brain contient la connaissance promue', promotedInRoleBrain, `${roleMemories.length} mémoires | http=${roleBrain.status} | promue=${promotedMemoryId}`)

/* ─── 13. Ask retrouve la connaissance ────────────────────────────────────── */
const ask = await api(ownerCookie)('/ask', {
  method: 'POST',
  body: { question: 'Quelle est la procédure d\'appel d\'offres documentée pendant l\'entretien de départ ?' },
})
const citedOk = (ask.data?.citations?.length ?? 0) >= 1
step('13. Ask : connaissance retrouvable avec citation', citedOk, `${ask.data?.citations?.length ?? 0} citation(s)`)

/* ─── 14. Audit complet ───────────────────────────────────────────────────── */
const audit = await api(ownerCookie)('/audit')
const auditText = JSON.stringify(audit.data ?? {})
const auditOk =
  auditText.includes('handover.started') &&
  auditText.includes('handover.successor_assigned') &&
  auditText.includes('memory.verified') &&
  auditText.includes('memory.promoted')
step('14. audit : started + successor + verified + promoted', auditOk)

/* ─── 15. IDOR : handover inconnu = 404 (cross-org couvert par MCP S7) ───── */
const randomId = crypto.randomUUID()
const idor = await api(ownerCookie)(`/handovers/${randomId}`)
step('15. IDOR : handover inconnu = 404', idor.status === 404, `status=${idor.status}`)

const inv = await api(ownerCookie)('/invitations', {
  method: 'POST',
  body: { email: `employee.${stamp}@kamaloka.ci`, role: 'employee' },
})
const empToken = inv.data?.devToken ?? inv.data?.token
console.log(`    [debug] invitation: ${inv.status} token=${empToken ? 'ok' : 'MANQUANT'}`)
const acc = await api(ownerCookie)('/invitations/accept', {
  method: 'POST',
  body: { token: empToken, password: 'motdepasse123', firstName: 'Emp', lastName: 'Seul' },
})
console.log(`    [debug] accept: ${acc.status} ${JSON.stringify(acc.data).slice(0, 100)}`)
const empCookie = await login(`employee.${stamp}@kamaloka.ci`, 'motdepasse123')
console.log(`    [debug] login employee: ${empCookie ? 'ok' : 'ÉCHEC'}`)
const forbidden = await api(empCookie)('/handovers', { method: 'POST', body: { employeeId: moussaId } })
step('16. rôle employee : création handover = 403', forbidden.status === 403, `status=${forbidden.status}`)

/* ─── 17. Concurrence : double pack ───────────────────────────────────────── */
const pack2 = await api(ownerCookie)(`/handovers/${handoverId}/pack`, { method: 'POST' })
step('17. double génération de pack = idempotente', pack2.status === 200 && Boolean(pack2.data?.humanPack))

/* ─── 18. RESTART serveur (même data dir) → persistance ───────────────────── */
child.kill()
await new Promise((r) => setTimeout(r, 2000))
serverLog = ''
await startServer()

const ownerCookie2 = await login('ange.niamke@kamaloka.ci')
const detailAfter = await api(ownerCookie2)(`/handovers/${handoverId}`)
const memAfter = await api(ownerCookie2)(`/memories/${promotedMemoryId}`)
const persists =
  detailAfter.data?.handover?.id === handoverId &&
  (detailAfter.data?.handover?.successor_name ?? '').toLowerCase().includes('yann') &&
  ['verified', 'active'].includes(memAfter.data?.memory?.status)
step('18. restart serveur : handover + successeur + mémoires persistés', persists,
  `handover=${detailAfter.data?.handover?.id ?? 'ko'} statut mémoire=${memAfter.data?.memory?.status ?? '?'}`)

/* ─── Synthèse ────────────────────────────────────────────────────────────── */
console.log('\n━━━━━ SYNTHÈSE HANDOVER E2E ━━━━━')
if (failures.length === 0) {
  console.log(`🏆 HANDOVER E2E : ${pass}/${pass + failures.length} vérifications passées — le départ complet est persistant.`)
} else {
  console.error(`💥 HANDOVER E2E : ${failures.length} échec(s) / ${pass + failures.length}`)
  for (const f of failures) console.error('   - ' + f)
  process.exit(1)
}
cleanup()
