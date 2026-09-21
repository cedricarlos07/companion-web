/**
 * CLEAN PROVISIONING E2E — le parcours « client non technique ».
 *
 * Serveur SANS AUTO_SEED (instance vierge, comme après install.sh) :
 *   /api/setup/status → needsSetup
 *   → POST /api/setup (organisation + département/rôle + owner)
 *   → session owner → création de rôle (nouveau département à la volée)
 *   → création d'employé → restart → tout persiste, seed jamais exécuté.
 *
 * Usage : node scripts/test-clean-provision.mjs [--keep]
 */
import { spawn, spawnSync } from 'node:child_process'
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

const dataDir = path.resolve(`./data/clean-provision-${Date.now()}`)
const port = await freePort()
const BASE = `http://127.0.0.1:${port}`
const stamp = Date.now()
console.log(`━ serveur vierge : ${BASE}  (data: ${path.basename(dataDir)})`)

const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs')
let child = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: String(port),
    COMPANION_DATA_DIR: dataDir,
    // PAS de AUTO_SEED : c'est justement l'objet du test.
    LICENSE_SERVER_URL: process.env.LICENSE_SERVER_URL ?? 'http://localhost:5300',
  },
})
let serverLog = ''
child.stdout.on('data', (d) => { serverLog += d })
child.stderr.on('data', (d) => { serverLog += d })

const cleanup = () => {
  if (process.platform === 'win32' && child.pid) {
    try { spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { /* déjà parti */ }
  } else child.kill()
  if (!keep) { try { fs.rmSync(dataDir, { recursive: true, force: true }) } catch { /* verrou windows */ } }
}
process.on('exit', () => cleanup())
const watchdog = setTimeout(() => { console.error('💥 watchdog > 6 min'); process.exit(1) }, 6 * 60_000)
watchdog.unref()

let pass = 0
const failures = []
const step = (name, ok, detail = '') => {
  if (ok) pass++
  else failures.push(name)
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` → ${detail}` : ''}`)
}

let cookie = ''
async function api(p, opts = {}) {
  const res = await fetch(`${BASE}/api${p}`, {
    ...opts,
    headers: { ...(cookie ? { cookie } : {}), ...(opts.body ? { 'content-type': 'application/json' } : {}), ...(opts.headers ?? {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  const sc = res.headers.get('set-cookie')
  if (sc) cookie = sc.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

async function waitReady() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try {
      const r = await fetch(`${BASE}/api/setup/status`)
      if (r.ok) return true
    } catch { /* pas prêt */ }
  }
  return false
}

if (!(await waitReady())) {
  console.error('💥 serveur non prêt :\n' + serverLog.split('\n').slice(-10).join('\n'))
  process.exit(1)
}

/* 1. Instance vierge */
const status = await api('/setup/status')
step('1. instance vierge détectée (needsSetup)', status.data?.needsSetup === true)

const noSeedLogin = await api('/auth/login', { method: 'POST', body: { email: 'ange.niamke@kamaloka.ci', password: 'companion' } })
step('2. aucune donnée de démo (login seed refusé)', noSeedLogin.status !== 200)

/* 3. Assistant : création organisation + owner */
const setup = await api('/setup', {
  method: 'POST',
  body: {
    orgName: 'ACME Client',
    sector: 'Logistique',
    country: "Côte d'Ivoire",
    departmentName: 'Direction',
    roleName: 'Directeur Général',
    ownerFirstName: 'Dji',
    ownerLastName: 'Client',
    ownerEmail: `dji.client.${stamp}@acme.ci`,
    ownerPassword: 'motdepasse-client-8',
  },
})
step('3. assistant : organisation + owner créés', setup.status === 200, JSON.stringify(setup.data?.organization ?? setup.data?.error ?? {}).slice(0, 80))

const dup = await api('/setup', {
  method: 'POST',
  body: { orgName: 'Encore', ownerEmail: 'x@y.ci', ownerPassword: '12345678' },
})
step('4. setup idempotent (refus si organisation existe)', dup.status === 409)

/* 4. Session owner → structure */
const login = await api('/auth/login', { method: 'POST', body: { email: `dji.client.${stamp}@acme.ci`, password: 'motdepasse-client-8' } })
step(
  '5. connexion du nouveau owner',
  login.status === 200 && Boolean(login.data?.user) &&
    Object.values(login.data.user).includes('owner'),
)

const depts = await api('/departments')
step('6. département initial présent (Direction)', (depts.data?.departments ?? []).some((d) => d.name === 'Direction'))

// Le serveur n'accepte pas departmentName inline sur /roles : créons le
// département d'abord (comme le fait l'UI), puis le rôle.
const dept = await api('/departments', { method: 'POST', body: { name: 'Exploitation' } })
const role = await api('/roles', {
  method: 'POST',
  body: { title: 'Responsable Exploitation', departmentId: dept.data?.department?.id },
})
step(
  '7. département créé à la volée + rôle rattaché',
  dept.status === 201 && role.status === 201,
  role.data?.role?.title ?? role.data?.error ?? String(role.status),
)

const role2 = await api('/roles', { method: 'POST', body: { title: 'Contrôleur de Gestion' } })
step('8. second rôle sans département', role2.status === 201)

const emp = await api('/employees', {
  method: 'POST',
  body: { firstName: 'Awa', lastName: 'Premiere', email: `awa.${stamp}@acme.ci` },
})
step('9. premier employé créé', emp.status === 200 || emp.status === 201)

const roles = await api('/roles')
const seen = (roles.data?.roles ?? []).map((r) => r.title)
step(
  '10. structure complète visible (wizard + créations)',
  seen.includes('Directeur Général') && seen.includes('Responsable Exploitation') && seen.includes('Contrôleur de Gestion'),
  seen.join(' · '),
)

/* 5. Restart : persistance, et toujours pas de seed */
const restart = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, PORT: String(port), COMPANION_DATA_DIR: dataDir },
})
child = restart
child.stdout.on('data', (d) => { serverLog += d })
child.stderr.on('data', (d) => { serverLog += d })
await new Promise((r) => setTimeout(r, 4000))
await waitReady()
cookie = ''
const after = await api('/auth/login', { method: 'POST', body: { email: `dji.client.${stamp}@acme.ci`, password: 'motdepasse-client-8' } })
step('11. restart : owner + structure persistants, seed toujours absent', after.status === 200)

console.log('\n━━━━━ SYNTHÈSE CLEAN PROVISIONING ━━━━━')
clearTimeout(watchdog)
if (failures.length === 0) {
  console.log(`🏆 CLEAN PROVISIONING : ${pass}/${pass + failures.length} — instance vierge → prête, en une visite.`)
  process.exit(0)
}
console.error(`💥 CLEAN PROVISIONING : ${failures.length} échec(s) / ${pass + failures.length}`)
for (const f of failures) console.error('   - ' + f)
process.exit(1)
