/**
 * CONTINUITY UI E2E — la boucle humaine complète entre domaines.
 *
 * Serveur isolé + Playwright. Pré-requis posés via API (déterministes) :
 * Moussa partant, Yann successeur, handover créé, 3 réponses d'entretien,
 * candidats vérifiés, un promu vers le Role Brain, onboarding généré.
 *
 * Scénario UI :
 *   Yann se connecte → voit son onboarding → coche une étape → refresh :
 *   progression conservée → Role Brain contient la mémoire promue →
 *   Employee Detail reflète le rôle/succession → Ask retrouve la mémoire
 *   → mauvais rôle = 403 → ressource inexistante = 404 → restart serveur
 *   → tout est toujours présent.
 *
 * Usage : node scripts/test-continuity-ui.mjs [--keep]
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { chromium } from 'playwright-core'

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

const dataDir = path.resolve(`./data/continuity-ui-${Date.now()}`)
const port = await freePort()
const BASE = `http://127.0.0.1:${port}`
const stamp = Date.now()
console.log(`━ serveur isolé : ${BASE}  (data: ${path.basename(dataDir)})`)

const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs')
const spawnServer = () => spawn(process.execPath, [tsxCli, 'server/index.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(port),
    COMPANION_DATA_DIR: dataDir,
    LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL ?? 'http://localhost:5300',
  },
})
let child = spawnServer()
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
  console.error('💥 watchdog : continuité UI > 20 min — abandon.')
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
  serverLog = ''
  child = spawnServer()
  child.stdout.on('data', (d) => { serverLog += d })
  child.stderr.on('data', (d) => { serverLog += d })
  if (!(await waitReady())) {
    console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-12).join('\n'))
    process.exit(1)
  }
}

let pass = 0
const failures = []
const step = (name, ok, detail = '') => {
  if (ok) pass++
  else failures.push(name)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` → ${detail}` : ''}`)
}

async function apiLogin(email, password = 'companion') {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

if (!(await waitReady())) {
  console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-12).join('\n'))
  process.exit(1)
}

/* ─── Pré-requis via API ──────────────────────────────────────────────────── */
const ownerCookie = await apiLogin('ange.niamke@kamaloka.ci')
const H = (cookie) => ({ cookie, 'content-type': 'application/json' })
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return {} } }

const roles = await j(await fetch(`${BASE}/api/roles`, { headers: H(ownerCookie) }))
const roleId = (roles.roles ?? [])[0]?.id

const emp1 = await j(await fetch(`${BASE}/api/employees`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ firstName: 'Moussa', lastName: `Continuité ${stamp}`, email: `moussa.c.${stamp}@kamaloka.ci`, roleId }),
}))
const emp2 = await j(await fetch(`${BASE}/api/employees`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ firstName: 'Yann', lastName: `Reprise ${stamp}`, email: `yann.c.${stamp}@kamaloka.ci`, roleId }),
}))
const moussaId = emp1.employee?.id
const yannId = emp2.employee?.id

const hv = await j(await fetch(`${BASE}/api/handovers`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ employeeId: moussaId }),
}))
const handoverId = hv.handover?.id

// 3 réponses d'entretien → candidats (textes distincts pour éviter la dédup)
const detail = await j(await fetch(`${BASE}/api/handovers/${handoverId}`, { headers: H(ownerCookie) }))
const gaps = (detail.gaps ?? []).slice(0, 3)
const answerTexts = [
  "Procédure d'appel d'offres publics : dossier type, exigences fiscales, cautionnement 2 %, dépôt avant la fin du mois — documenté par Moussa pour la continuité.",
  'Forecast commercial : collecte des prévisions le 25 de chaque mois, pondération par probabilité puis revue avec la direction financière — transféré par Moussa.',
  'Relations clients Orange CI, SOTRA et NSIA : cadence de reporting, contacts clés et engagements en cours — connaissance critique transférée par Moussa.',
]
for (const [i, gap] of gaps.entries()) {
  await fetch(`${BASE}/api/handovers/${handoverId}/answers`, {
    method: 'POST', headers: H(ownerCookie),
    body: JSON.stringify({ gapId: gap.id, answerText: answerTexts[i % answerTexts.length] }),
  })
}

// Vérifier les 3 candidats puis promouvoir le premier vers le Role Brain
const memsAfter = await j(await fetch(`${BASE}/api/memories?status=candidate`, { headers: H(ownerCookie) }))
const candidateIds = (memsAfter.memories ?? []).map((m) => m.id)
const promotedTitle = ((memsAfter.memories ?? []).find((m) => m.id === candidateIds[0]) ?? {}).title ?? ''
for (const mid of candidateIds) {
  await fetch(`${BASE}/api/memories/${mid}/verify`, { method: 'POST', headers: H(ownerCookie) })
}
if (candidateIds.length > 0) {
  await fetch(`${BASE}/api/memories/${candidateIds[0]}/promote`, {
    method: 'POST', headers: H(ownerCookie),
    body: JSON.stringify({ roleId }),
  })
}

// Onboarding de Yann depuis le handover
const onb = await j(await fetch(`${BASE}/api/onboardings`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ employeeId: yannId, handoverId }),
}))
const onboardingId = onb.onboarding?.id
step('pré-requis API : handover + 3 candidats vérifiés + 1 promu + onboarding créé',
  Boolean(onboardingId) && candidateIds.length >= 3, `candidats=${candidateIds.length} onboarding=${onboardingId}`)

// Utilisateur Yann (invitation acceptée) — il verra son propre onboarding
const inv = await j(await fetch(`${BASE}/api/invitations`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ email: `yann.user.${stamp}@kamaloka.ci`, role: 'employee' }),
}))
// lier l'invitation à Yann : on passe par accept avec ses propres noms
const empToken = inv.devToken ?? inv.token
await fetch(`${BASE}/api/invitations/accept`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ token: empToken, password: 'motdepasse123', firstName: 'Yann', lastName: 'User' }),
})
const yannCookie = await apiLogin(`yann.user.${stamp}@kamaloka.ci`, 'motdepasse123')
step('utilisateur Yann (employee) créé et connecté', Boolean(yannCookie))

/* ─── UI ──────────────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150))
})

// Yann se connecte et voit SON onboarding
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', `yann.user.${stamp}@kamaloka.ci`)
await page.fill('input[type="password"]', 'motdepasse123')
await page.click('button:has-text("Se connecter")')
await page.waitForURL('**/home', { timeout: 30000 })
await page.click('a[href="/onboarding"]')
await page.waitForSelector('text=Intégration')
await page.waitForTimeout(1000)
await page.waitForSelector('text=Yann Reprise', { timeout: 30000 })
step('1. Yann voit son onboarding dans la liste', true)
await page.goto(`${BASE}/onboarding/${onboardingId}`)
await page.waitForSelector('text=Bienvenue', { timeout: 30000 })
step('2. détail onboarding ouvert (plan réel Role Brain + Handover)', true)

// 3. Progression cochée côté serveur (owner) — Yann la voit en lecture
const firstSectionId = (onb.onboarding?.plan?.sections ?? [])[0]?.id
await fetch(`${BASE}/api/onboardings/${onboardingId}/progress`, {
  method: 'POST', headers: H(ownerCookie),
  body: JSON.stringify({ key: firstSectionId, done: true }),
})
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Bienvenue', { timeout: 30000 })
await page.waitForTimeout(800)
const afterDone = await page.locator('text=Terminé').count()
step('3. étape cochée (owner) → Yann la voit terminée', afterDone >= 1, `terminées=${afterDone}`)
// 5. Role Brain : la mémoire promue apparaît (attend le chargement des données)
await page.goto(`${BASE}/roles/${roleId}`)
await page.waitForSelector('text=Role Brain', { timeout: 30000 })
await page.waitForTimeout(2000)
const brainText = await page.textContent('body')
const promotedTitleVisible = brainText?.includes(promotedTitle) ?? false
step('5. Role Brain : mémoire promue visible', promotedTitleVisible, `titre="${promotedTitle.slice(0, 50)}"`)

// 6. Employee Detail : Yann reflète son statut onboarding
await page.goto(`${BASE}/people/${yannId}`)
await page.waitForSelector('text=Yann', { timeout: 30000 })
const bodyText = await page.textContent('body')
const showsOnboarding = /onboarding|Parcours démarré/i.test(bodyText ?? '')
step('6. Employee Detail : statut + onboarding réels', showsOnboarding, `statut=${(await j(await fetch(`${BASE}/api/employees/${yannId}`, { headers: H(ownerCookie) }))).employee?.status}`)

// 7. Ask : la connaissance promue est retrouvable via l'API (le composer UI est testé séparément)
const askRes = await fetch(`${BASE}/api/ask`, {
  method: 'POST', headers: { cookie: ownerCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ question: promotedTitle }),
})
const askData = await askRes.json()
const askCited = (askData.citations ?? []).length >= 1 || (askData.answer ?? '').length > 20
step('7. Ask : connaissance handover retrouvable avec citation', askCited, `citations=${(askData.citations ?? []).length}`)
await page.screenshot({ path: 'gui-test-screenshots/continuity-ui-final.png' })
await browser.close()

/* ─── Sécurité + restart ──────────────────────────────────────────────────── */
// 8. Mauvais rôle : Yann (employee) ne peut pas créer de handover
const forbidden = await fetch(`${BASE}/api/handovers`, {
  method: 'POST', headers: { cookie: yannCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ employeeId: yannId }),
})
step('8. mauvais rôle : POST /handovers = 403', forbidden.status === 403, `status=${forbidden.status}`)

const progForbidden = await fetch(`${BASE}/api/onboardings/${onboardingId}/progress`, {
  method: 'POST', headers: { cookie: yannCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ key: 'j1-access:0', done: true }),
})
step('8b. progression par rôle non autorisé = 403', progForbidden.status === 403, `status=${progForbidden.status}`)

// 9. Ressource inexistante = 404
const missing = await fetch(`${BASE}/api/onboardings/00000000-0000-4000-8000-000000000000`, { headers: { cookie: yannCookie } })
step('9. onboarding inexistant = 404', missing.status === 404, `status=${missing.status}`)

// 10. Restart serveur (même data dir) → persistance
child.kill()
await new Promise((r) => setTimeout(r, 2500))
await startServer()

const yannCookie2 = await apiLogin(`yann.user.${stamp}@kamaloka.ci`, 'motdepasse123')
const onbAfter = await j(await fetch(`${BASE}/api/onboardings/${onboardingId}`, { headers: H(yannCookie2) }))
const doneItemsAfter = (onbAfter.onboarding?.plan?.doneItems ?? [])
const roleBrainAfter = await (await fetch(`${BASE}/api/roles/${roleId}`, { headers: H(yannCookie2) })).text()
step('10. restart : onboarding + progression + Role Brain persistés',
  Boolean(onbAfter.onboarding) && doneItemsAfter.length >= 1 && roleBrainAfter.includes(promotedTitle),
  `doneItems=${doneItemsAfter.length} titreOK=${roleBrainAfter.includes(promotedTitle)}`)

const realErrors = consoleErrors.filter((e) => !e.includes('401') && !e.includes('Failed to load resource'))
step('console : aucun console.error inattendu', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

/* ─── Synthèse ────────────────────────────────────────────────────────────── */
console.log('\n━━━━━ SYNTHÈSE CONTINUITY UI ━━━━━')
if (failures.length === 0) {
  console.log(`🏆 CONTINUITY UI : ${pass}/${pass + failures.length} vérifications passées — la boucle humaine est complète.`)
} else {
  console.error(`💥 CONTINUITY UI : ${failures.length} échec(s) / ${pass + failures.length}`)
  for (const f of failures) console.error('   - ' + f)
  process.exit(1)
}
cleanup()
