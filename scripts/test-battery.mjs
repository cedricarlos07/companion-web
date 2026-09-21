/**
 * BATTERIE DE TESTS — serveur isolé par run.
 *
 * Démarre un serveur Companion dédié (data dir PGlite neuf, port libre),
 * attend la readiness, enchaîne les 5 suites (démo, billing, agents,
 * sécurité, MCP), puis détruit le data dir. Jamais de data dir partagé :
 * chaque run est reproductible et sans état.
 *
 * Usage :
 *   node scripts/test-battery.mjs              # batterie complète
 *   node scripts/test-battery.mjs --only billing,mcp
 *   node scripts/test-battery.mjs --keep       # conserve le data dir (debug)
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'

const only = (() => {
  const i = process.argv.indexOf('--only')
  return i === -1 ? null : process.argv[i + 1]?.split(',')
})()
const keep = process.argv.includes('--keep')

const SUITES = [
  ['demo', 'scripts/demo-test.mjs'],
  ['billing', 'scripts/test-billing.mjs'],
  ['agents', 'scripts/test-agents.mjs'],
  ['security', 'scripts/test-agent-security.mjs'],
  ['mcp', 'scripts/test-mcp.mjs'],
].filter(([name]) => !only || only.includes(name))

if (SUITES.length === 0) {
  console.error(`suites inconnues — disponibles : demo, billing, agents, security, mcp`)
  process.exit(2)
}

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

const dataDir = path.resolve(`./data/test-battery-${Date.now()}`)
const port = await freePort()
const base = `http://127.0.0.1:${port}`
console.log(`━ serveur isolé : ${base}  (data: ${path.basename(dataDir)})`)

// tsx lancé via node directement : `npx` peut attendre sur stdin sous Windows.
const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs')
const child = spawn(process.execPath, [tsxCli, 'server/index.ts'], {
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
child.stdout.on('data', (d) => {
  serverLog += d
  for (const line of d.toString().split('\n')) if (line.trim()) console.log(`  [server] ${line}`)
})
child.stderr.on('data', (d) => {
  serverLog += d
  for (const line of d.toString().split('\n')) if (line.trim()) console.log(`  [server!] ${line}`)
})

const cleanup = () => {
  child.kill()
  if (!keep) {
    // laisse le processus libérer le dir avant suppression
    setTimeout(() => fs.rmSync(dataDir, { recursive: true, force: true }), 1500)
  } else {
    console.log(`data dir conservé : ${dataDir}`)
  }
}
process.on('exit', cleanup)
process.on('SIGINT', () => { child.kill(); process.exit(130) })

// Watchdog global : aucune suite ne doit bloquer la batterie.
setTimeout(() => {
  console.error('💥 watchdog : batterie > 25 min — abandon.')
  process.exit(1)
}, 25 * 60_000).unref()

// Readiness : la racine répond (même 401/404 = serveur prêt).
let ready = false
for (let i = 0; i < 60 && !ready; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  try {
    await fetch(`${base}/api/entitlements`)
    ready = true
  } catch { /* pas encore prêt */ }
  if (!ready && serverLog.includes('démarrage impossible')) break
}

if (!ready) {
  console.error('💥 serveur isolé non prêt :')
  console.error(serverLog.split('\n').slice(-10).join('\n'))
  process.exit(1)
}

const results = []
for (const [name, file] of SUITES) {
  console.log(`\n━━━━━ ${name.toUpperCase()} ━━━━━`)
  const r = spawnSync(process.execPath, [file], {
    stdio: 'inherit',
    env: { ...process.env, BASE_URL: base },
    timeout: 10 * 60_000,
  })
  results.push({ name, ok: r.status === 0 })
}

cleanup()

const failed = results.filter((r) => !r.ok)
console.log('\n━━━━━ SYNTHÈSE BATTERIE ━━━━━')
for (const r of results) console.log(`${r.ok ? '🏆' : '💥'} ${r.name}`)
if (failed.length > 0) {
  console.error(`💥 ${failed.length} suite(s) en échec : ${failed.map((f) => f.name).join(', ')}`)
  process.exit(1)
}
console.log('🏆 BATTERIE COMPLÈTE : toutes les suites passent.')
