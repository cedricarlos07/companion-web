/**
 * SCAN FRONTEND — gate anti-mock.
 *
 * Règles :
 *   1. Aucun import de fixtures (`@/data/*`) hors ALLOWLIST, dans pages et
 *      composants. Chaque entrée ALLOWLIST est une page NON TERMINÉE — la
 *      liste doit rétrécir jusqu'à zéro.
 *   2. Aucun identifiant mock/fake/fixture/demoData/sampleData dans pages et
 *      composants (hors commentaires).
 *   3. Aucun `setTimeout` simulant une API dans src/services/.
 *   4. ALLOW_MOCK_DATA doit valoir false (ou être absent) dans tout build
 *      production — vérifié côté runtime par src/main.tsx.
 *
 * Usage : node scripts/check-frontend.mjs   (exit 1 si violation hors allowlist)
 */
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.resolve('src')

/** Pages/composants qui consomment encore des fixtures — travail restant.
 *  Retirer une ligne = page branchée sur l'API réelle et auditée. */
const ALLOWLIST = [
  'src/pages/activity.tsx',
  'src/pages/agent-detail.tsx',
  'src/pages/automations.tsx',
  'src/pages/brain.tsx',
  'src/pages/employee-detail.tsx',
  'src/pages/home.tsx',
  'src/pages/knowledge-risk.tsx',
  'src/pages/login.tsx',
  'src/pages/memory-detail.tsx',
  'src/pages/onboarding-detail.tsx',
  'src/pages/onboarding.tsx',
  'src/pages/people.tsx',
  'src/pages/role-brain.tsx',
  'src/pages/roles.tsx',
  'src/pages/settings.tsx',
  'src/pages/sources.tsx',
  'src/pages/portal/dashboard.tsx',
  'src/pages/portal/license.tsx',
  'src/pages/portal/downloads.tsx',
  'src/pages/portal/instances.tsx',
  'src/pages/portal/invoices.tsx',
  'src/pages/portal/support.tsx',
  'src/pages/portal/portal-layout.tsx',
  'src/components/layout/app-sidebar.tsx',
  'src/components/layout/global-search.tsx',
]

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'data') yield* walk(p)
    else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) yield p
  }
}

const violations = []
const allowlisted = []

for (const file of walk(SRC)) {
  const rel = path.relative(process.cwd(), file).replaceAll('\\', '/')
  const inPages = rel.startsWith('src/pages/') || rel.startsWith('src/components/')
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split('\n')

  lines.forEach((line, idx) => {
    const noComment = line.replace(/\/\/.*$/, '')
    if (inPages && /from\s+['"]@\/data\//.test(noComment)) {
      if (ALLOWLIST.includes(rel)) allowlisted.push(`${rel}:${idx + 1}`)
      else violations.push(`${rel}:${idx + 1}  import fixtures: ${noComment.trim().slice(0, 90)}`)
    }
    if (inPages && /\b(demoData|fakeData|fixtureData|sampleData)\b/.test(noComment)) {
      violations.push(`${rel}:${idx + 1}  identifiant mock: ${noComment.trim().slice(0, 90)}`)
    }
    if (rel.startsWith('src/services/') && /setTimeout/.test(noComment)) {
      violations.push(`${rel}:${idx + 1}  setTimeout dans la couche API (simulation interdite)`)
    }
  })
}

if (allowlisted.length > 0) {
  console.warn(`⚠  FRONTEND : ${allowlisted.length} référence(s) de fixtures encore allowlistées (${ALLOWLIST.length} fichier(s)) — à brancher :`)
  const byFile = {}
  for (const a of allowlisted) {
    const f = a.split(':')[0]
    byFile[f] = (byFile[f] ?? 0) + 1
  }
  for (const [f, n] of Object.entries(byFile)) console.warn(`    - ${f} (${n})`)
}

if (violations.length > 0) {
  console.error(`💥 FRONTEND CHECK : ${violations.length} violation(s) hors allowlist :`)
  for (const v of violations) console.error('    - ' + v)
  process.exit(1)
}
console.log('🏆 FRONTEND CHECK : aucune nouvelle dépendance mock hors allowlist.')
