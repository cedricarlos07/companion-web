/**
 * FRONTEND REAL DATA E2E — la gate de sortie de la phase anti-mock.
 *
 * Serveur isolé (data dir jetable) + navigateur headless : chaque page
 * branchée est vérifiée sur des données réelles — persistance après
 * refresh, permissions (403 affichés), erreurs affichées, aucun
 * console.error inattendu, aucun chiffre codé en dur.
 *
 * Usage : node scripts/test-frontend-real.mjs [--keep]
 */
import { spawn, spawnSync } from 'node:child_process'
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

const dataDir = path.resolve(`./data/frontend-real-${Date.now()}`)
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
const watchdog = setTimeout(() => {
  console.error('💥 watchdog : FRONTEND REAL E2E > 15 min — abandon.')
  process.exit(1)
}, 15 * 60_000)
watchdog.unref()

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

if (!(await waitReady())) {
  console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-12).join('\n'))
  process.exit(1)
}

/* ─── Navigateur ──────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const consoleErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 150))
})

// 1. Mauvais mot de passe → erreur affichée, pas de navigation.
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', 'ange.niamke@kamaloka.ci')
await page.fill('input[type="password"]', 'mauvais')
await page.click('button:has-text("Se connecter")')
await page.waitForSelector('[role="alert"]', { timeout: 15000 })
step('1. login refusé → erreur affichée (pas de fallback)', (await page.locator('[role="alert"]').innerText()).length > 5)
step('1b. toujours sur /login', page.url().includes('/login'))

// 2. Bon mot de passe → /home avec chiffres réels.
await page.fill('input[type="password"]', 'companion')
await page.click('button:has-text("Se connecter")')
await page.waitForURL('**/home', { timeout: 30000 })
await page.waitForSelector('text=Bonjour Ange', { timeout: 30000 })
const greeting = await page.locator('h1').first().innerText()
step('2. /home : greeting = session réelle', greeting.includes('Ange'), greeting)
const ownerCookie = await cookieOf(page)
const overview = await (await fetch(`${BASE}/api/overview`, { headers: { cookie: ownerCookie } })).json()
await page.waitForSelector(`text=${overview.stats.employees} employés`, { timeout: 30000 })
const homeText = await page.locator('main').innerText()
step(
  '2b. /home : KPI réels (employés/mémoires depuis /overview)',
  homeText.includes(String(overview.stats.employees)) && homeText.includes('Risque de savoir'),
  `employees=${overview.stats.employees}`,
)

// 3. /people : création réelle + persistance après refresh.
await page.goto(`${BASE}/people`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('button:has-text("Ajouter un employé")')
await page.click('button:has-text("Ajouter un employé")')
await page.fill('input[placeholder="Awa"]', 'Awa')
await page.fill('input[placeholder="Traoré"]', `Realdata ${stamp}`.slice(0, 20))
await page.fill('input[placeholder="awa.traore@entreprise.ci"]', `awa.realdata.${stamp}@kamaloka.ci`)
await page.click('button:has-text("Créer")')
await page.waitForSelector(`text=Awa Realdata`, { timeout: 15000 }).catch(() => {})
const createdVisible = await page.locator(`text=Awa Realdata`).count()
step('3. /people : employé créé via POST /employees', createdVisible >= 1)
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Awa Realdata', { timeout: 30000 })
step('3b. /people : employé persistant après refresh', true)

// 4. Permission refusée : l'auditeur ne peut pas créer d'employé — erreur serveur affichée.
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', 'audit@kamaloka.ci')
await page.fill('input[type="password"]', 'companion')
await page.click('button:has-text("Se connecter")')
await page.waitForURL('**/home', { timeout: 30000 })
await page.goto(`${BASE}/people`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('button:has-text("Ajouter un employé")')
await page.click('button:has-text("Ajouter un employé")')
await page.fill('input[placeholder="Awa"]', 'Interdit')
await page.fill('input[placeholder="Traoré"]', 'Audit')
await page.fill('input[placeholder="awa.traore@entreprise.ci"]', `interdit.${stamp}@kamaloka.ci`)
await page.click('button:has-text("Créer")')
await page.waitForFunction(
  () => document.body.innerText.includes('permission'),
  { timeout: 30000 },
)
const toastText = await page.locator('[role="status"], [role="alert"]').allInnerTexts().catch(() => [])
const refused = toastText.join(' ').includes('permission')
step(
  '4. auditeur → création employé : 403 affiché (permission refusée)',
  refused,
  toastText.join(' ').slice(0, 60),
)

// Retour owner pour la suite.
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' })
await page.fill('input[type="email"]', 'ange.niamke@kamaloka.ci')
await page.fill('input[type="password"]', 'companion')
await page.click('button:has-text("Se connecter")')
await page.waitForURL('**/home', { timeout: 30000 })

// 5. /sources/new : import texte réel → résultats réels (pas de « 31 » codé).
await page.goto(`${BASE}/sources/new`, { waitUntil: 'domcontentloaded' })
await page.click('button:has-text("Coller du texte")').catch(async () => {
  // SegmentedControl : clic sur l'item directement
  await page.click('text=Coller du texte')
})
await page.fill('textarea', `Procédure Realdata ${stamp} : toute demande client urgent doit être confirmée par email auprès du responsable avant engagement. Le délai de réponse maximal est de 4 heures ouvrées.`)
await page.click('button:has-text("Lancer l\'analyse")')
await page.waitForSelector('text=Analyse terminée', { timeout: 180000 })
const resultText = await page.locator('main').innerText()
step(
  '5. /sources/new : analyse réelle terminée (moteur affiché)',
  /Moteur : /.test(resultText),
  (resultText.match(/Moteur : \S+/) ?? ['?'])[0],
)

// 6. /agents : kill switch persistant.
await page.goto(`${BASE}/agents`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Knowledge Agent', { timeout: 15000 })
await page.click('button:has-text("Démarrer") >> nth=0')
await page.waitForSelector('text=Mettre en pause', { timeout: 15000 })
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Knowledge Agent', { timeout: 15000 })
await page.waitForTimeout(800)
const runningBadge = await page.locator('text=En cours').count()
step('6. /agents : statut démarré persistant après refresh', runningBadge >= 1)

// 7. /settings : renommage d'organisation persistant.
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Nom de l\'entreprise', { timeout: 15000 })
await page.fill('input >> nth=0', `Kamaloka Realdata ${stamp}`.slice(0, 30))
await page.click('button:has-text("Enregistrer")')
await page.waitForSelector('text=Organisation mise à jour', { timeout: 15000 })
await page.goto(`${BASE}/settings`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(
  () => {
    const v = document.querySelector('input')?.value ?? ''
    return v.length > 0
  },
  { timeout: 30000 },
)
const orgNameInput = await page.locator('input >> nth=0').inputValue()
step(
  '7. /settings : renommage persistant après refresh',
  orgNameInput.includes('Realdata'),
  orgNameInput,
)

// 8. /automations : toggle trigger persistant (assertion côté serveur + UI).
await page.goto(`${BASE}/automations`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Quand', { timeout: 30000 })
await page.click('button:has-text("Mettre en pause") >> nth=0')
await page.waitForSelector('button:has-text("Activer")', { timeout: 30000 })
const triggersAfter = await (await fetch(`${BASE}/api/triggers`, { headers: { cookie: ownerCookie } })).json()
const disabledServer = (triggersAfter.triggers ?? []).filter((t) => !t.enabled).length
await page.reload({ waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=Quand', { timeout: 30000 })
await page.waitForSelector('text=En pause', { timeout: 30000 })
step('8. /automations : trigger désactivé persistant (serveur + UI)', disabledServer >= 1)

// 9. /brain : connaissances réelles depuis l'import de l'étape 5.
await page.goto(`${BASE}/brain`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(
  () => {
    const t = document.querySelector('main')?.innerText ?? ''
    return t.length > 100 && !t.includes('Chargement')
  },
  { timeout: 30000 },
)
step('9. /brain : mémoire réelle chargée (aucun état de chargement bloqué)', true)

// 10. /ask : réponse réelle avec citations + abstention honnête.
await page.goto(`${BASE}/ask`, { waitUntil: 'domcontentloaded' })
await page.fill('textarea', "Quelles pièces sont exigées pour un appel d’offres chez Orange CI ?")
await page.keyboard.press('Enter')
await page.waitForSelector('text=Réponse de Companion', { timeout: 120000 })
const askMain = await page.locator('main').innerText()
const cited = await page.locator('text=Sources utilisées').count()
step(
  '10. /ask : réponse citée (sources affichées)',
  askMain.length > 50 && cited >= 1,
)
// Abstention déterministe : périmètre = l'employée créée à l'étape 3 (zéro
// mémoire) → le moteur DOIT s'abstenir plutôt qu'inventer (clause d'accès).
const emps = await page.evaluate(async () => {
  const r = await fetch('/api/employees', { credentials: 'include' })
  return r.json()
})
const awa = (emps.employees ?? []).find((e) => String(e.email).includes('awa.realdata'))
const abstainRes = await page.evaluate(async (employeeId) => {
  const r = await fetch('/api/ask', {
    method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'Quelle est la procédure interne de ce poste ?', employeeId }),
  })
  return r.json()
}, awa?.id)
step(
  '10b. /ask : abstention déterministe sur périmètre sans mémoire',
  abstainRes?.abstained === true && (abstainRes?.citations ?? []).length === 0,
  abstainRes?.abstained ? 'abstained' : `répondu avec ${(abstainRes?.citations ?? []).length} citations`,
)

// Console : aucun console.error inattendu.
await page.screenshot({ path: 'gui-test-screenshots/frontend-real-final.png' })
await browser.close()
const realErrors = consoleErrors.filter((e) => !e.includes('401') && !e.includes('Failed to load resource') && !e.includes('403'))
step('12. console : aucun console.error inattendu', realErrors.length === 0, realErrors.slice(0, 2).join(' | '))

console.log('\n━━━━━ SYNTHÈSE FRONTEND REAL DATA ━━━━━')
clearTimeout(watchdog)
if (failures.length === 0) {
  console.log(`🏆 FRONTEND REAL DATA : ${pass}/${pass + failures.length} vérifications passées.`)
cleanup()
process.exit(0)
} else {
  console.error(`💥 FRONTEND REAL DATA : ${failures.length} échec(s) / ${pass + failures.length}`)
  for (const f of failures) console.error('   - ' + f)
  process.exit(1)
}

async function cookieOf(p) {
  const cookies = await p.context().cookies(BASE)
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ')
}
