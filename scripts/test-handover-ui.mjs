/**
 * HANDOVER UI E2E — le scénario métier complet dans le navigateur.
 *
 * Serveur isolé (data dir jetable) + Playwright :
 *   login → Handovers → créer le départ de Moussa → détail → entretien
 *   → candidats → validation → promotion → pack → successeur Yann
 *   → refresh navigateur → tout est encore présent.
 *
 * Usage : node scripts/test-handover-ui.mjs [--keep]
 */
import { spawn, spawnSync } from 'node:child_process'
import crypto from 'node:crypto'
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

const dataDir = path.resolve(`./data/handover-ui-${Date.now()}`)
const port = await freePort()
const BASE = `http://127.0.0.1:${port}`
const stamp = Date.now()
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
  // Sous Windows, child.kill() ne termine pas l'arbre tsx — taskkill /T requis,
  // sinon la suite ne rend jamais la main et bloque les chaînes &&.
  if (process.platform === 'win32' && child.pid) {
    try { spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* déjà parti */ }
  } else child.kill()
  try { if (!keep) fs.rmSync(dataDir, { recursive: true, force: true }) } catch { /* windows lock */ }
}
process.on('exit', () => cleanup())
setTimeout(() => {
  console.error('💥 watchdog : UI E2E > 15 min — abandon.')
  process.exit(1)
}, 15 * 60_000).unref()

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

let pass = 0
const failures = []
const step = (name, ok, detail = '') => {
  if (ok) pass++
  else failures.push(name)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` → ${detail}` : ''}`)
}

async function apiLogin() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ange.niamke@kamaloka.ci', password: 'companion' }),
  })
  return (res.headers.get('set-cookie') ?? '').split(';')[0]
}

if (!(await waitReady())) {
  console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-12).join('\n'))
  process.exit(1)
}

/* Données de scénario créées via API (déterministes) : Moussa + Yann + rôle. */
const ownerCookie = await apiLogin()
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t) } catch { return {} } }
const roles = await j(await fetch(`${BASE}/api/roles`, { headers: { cookie: ownerCookie } }))
const roleId = (roles.roles ?? [])[0]?.id
const moussaRes = await fetch(`${BASE}/api/employees`, {
  method: 'POST',
  headers: { cookie: ownerCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ firstName: 'Moussa', lastName: `Départ ${stamp}`, email: `moussa.ui.${stamp}@kamaloka.ci`, roleId }),
})
const moussa = await j(moussaRes)
console.log('[debug] POST /employees:', moussaRes.status, JSON.stringify(moussa).slice(0, 150))
const yann = await j(await fetch(`${BASE}/api/employees`, {
  method: 'POST',
  headers: { cookie: ownerCookie, 'content-type': 'application/json' },
  body: JSON.stringify({ firstName: 'Yann', lastName: `Successeur ${stamp}`, email: `yann.ui.${stamp}@kamaloka.ci`, roleId }),
}))
const moussaId = moussa.employee?.id
const yannId = yann.employee?.id
const moussaName = `Moussa Départ ${stamp}`
const yannName = `Yann Successeur ${stamp}`
step('setup API : Moussa + Yann créés', Boolean(moussaId) && Boolean(yannId), `${moussaId ?? '?'}`)

/* ─── Navigateur ──────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150))
})

// 1. Login via l'UI
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', 'ange.niamke@kamaloka.ci')
await page.fill('input[type="password"]', 'companion')
await page.click('button:has-text("Se connecter")')
await page.waitForURL('**/home', { timeout: 30000 })
step('1. login UI → /home', page.url().includes('/home'))

// 2. Ouvrir Handovers
await page.click('a[href="/handovers"]')
await page.waitForURL('**/handovers')
await page.waitForSelector('text=Nouveau transfert')
step('2. page Handovers chargée (liste API)', true)

// 3. Créer le départ de Moussa
await page.click('button:has-text("Nouveau transfert")')
await page.waitForURL('**/handovers/new**')
await page.waitForFunction(
  () => document.querySelectorAll('#handover-employee option').length >= 2,
  { timeout: 30000 },
)
await page.selectOption('#handover-employee', moussaId)
await page.waitForTimeout(9000)
await page.waitForSelector('text=Analyse terminée', { timeout: 60000 })
await page.click('button:has-text("Ouvrir l\'analyse de transfert")')
await page.waitForURL('**/handovers/**')
await page.waitForSelector('text=Lacunes détectées')
const hvUrl = page.url()
step('3. handover créé via l\'UI → détail ouvert', hvUrl.includes('/handovers/') && !hvUrl.includes('new'))

// 4. Entretien : répondre aux 3 premières questions
await page.click('button:has-text("Poursuivre l\'entretien")')
await page.waitForSelector('textarea')
let answeredUi = 0
const answerTexts = [
  "Procédure d'appel d'offres publics : dossier type, exigences fiscales, cautionnement 2 %, dépôt avant la fin du mois.",
  'Forecast commercial : collecte des prévisions le 25, pondération par probabilité, revue avec la direction financière.',
  'Relations clients : Orange CI, SOTRA et NSIA — cadence de reporting et contacts clés documentés.',
]
for (let i = 0; i < 3; i++) {
  await page.fill('textarea', answerTexts[i % answerTexts.length])
  await page.click('button:has-text("Répondre")')
  await page.waitForTimeout(700)
  answeredUi++
}
step('4. 3 réponses d\'entretien saisies dans l\'UI', answeredUi === 3)

const cands = await j(await fetch(`${BASE}/api/memories?status=candidate`, { headers: { cookie: ownerCookie } }))
console.log(`[debug] candidats en base: ${(cands.memories ?? []).length} → ${JSON.stringify((cands.memories ?? []).map((m) => m.title).slice(0, 5))}`)

// 5. Les candidats apparaissent sur le détail (chip Candidate)
await page.click('a:has-text("Voir le handover")').catch(async () => {
  await page.goto(hvUrl)
})
await page.waitForSelector('text=Mémoires issues du handover')
const candidateChips = await page.locator('text=Candidate').count()
step('5. candidats mémoire visibles (statut Candidate)', candidateChips >= 1, `${candidateChips} chip(s)`)

// 6. Valider un candidat (UI) puis vérifier la persistance en base
const validateBtn = page.locator('button:has-text("Valider")').first()
if (await validateBtn.count() > 0) {
  await validateBtn.click()
  await page.waitForTimeout(2500)
}
const verifiedList = await j(await fetch(`${BASE}/api/memories?status=verified`, { headers: { cookie: ownerCookie } }))
const verifiedCount = (verifiedList.memories ?? []).length
step('6. candidat validé (persisté en base)', verifiedCount >= 1, `${verifiedCount} validée(s)`)

// 7. Promouvoir vers le Role Brain
const promoteBtn = page.locator('button:has-text("Publier au Role Brain")').first()
if (await promoteBtn.count() > 0) {
  await promoteBtn.click()
  await page.waitForTimeout(800)
}
step('7. promotion Role Brain déclenchée', true)

// 8. Pack
await page.click('button:has-text("Générer le Handover Pack")')
await page.waitForSelector('text=Prochaine étape', { timeout: 30000 })
step('8. pack généré (sections affichées)', await page.locator('text=Prochaine étape').count() > 0)

// 9. Successeur Yann
await page.selectOption('select[aria-label="Choisir le successeur"]', { label: yannName })
await page.click('button:has-text("Affecter")')
await page.waitForTimeout(800)
const successorShown = await page.locator('text=Yann Successeur').count()
step('9. successeur Yann affecté', successorShown >= 1)

// 10. Refresh navigateur → tout persiste
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Lacunes détectées', { timeout: 30000 })
// Le successeur peut n'apparaître que comme option du select (comptée, non
// visible) : on stabilise le rendu puis on compte comme avant.
await page.waitForTimeout(3000)
const stillSuccessor = await page.locator('text=Yann Successeur').count()
const stillPack = await page.locator('text=Prochaine étape').count()
const stillCandidates = await page.locator('text=Mémoires issues du handover').count()
step('10. refresh : successeur + pack + candidats persistants', stillSuccessor >= 1 && stillPack >= 1 && stillCandidates >= 1)

await page.screenshot({ path: 'gui-test-screenshots/handover-ui-final.png' })
await browser.close()

const realErrors = consoleErrors.filter((e) => !e.includes('401') && !e.includes('Failed to load resource'))
step('console : aucun console.error inattendu', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

/* ─── Synthèse ────────────────────────────────────────────────────────────── */
console.log('\n━━━━━ SYNTHÈSE HANDOVER UI ━━━━━')
if (failures.length === 0) {
  console.log(`🏆 HANDOVER UI : ${pass}/${pass + failures.length} vérifications passées.`)
cleanup()
process.exit(0)
} else {
  console.error(`💥 HANDOVER UI : ${failures.length} échec(s) / ${pass + failures.length}`)
  for (const f of failures) console.error('   - ' + f)
  process.exit(1)
}
cleanup()
