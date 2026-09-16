/* Audit des 27 routes : boutons morts, mocks, actions manquantes. */
const fs = require('fs')
const path = require('path')

const pagesDir = path.join(__dirname, '..', 'src', 'pages')
const files = fs.readdirSync(pagesDir).filter((f) => f.endsWith('.tsx'))
const rows = []

for (const file of files) {
  const content = fs.readFileSync(path.join(pagesDir, file), 'utf8')
  const route = '/' + file.replace('.tsx', '')
  const apiCalls = (content.match(/api\.\w+\(/g) || []).length
  const mockCalls = (content.match(/pushToast\([^)]*(?:démo|mock|simulé|simulate)[^)]*\)/gi) || []).length
  const emptyHandlers = (content.match(/onClick=\{\(\) => \{\s*\}\}/g) || []).length
  const deadLinks = (content.match(/href="#"/g) || []).length
  if (mockCalls > 0 || emptyHandlers > 0 || deadLinks > 0 || apiCalls === 0) {
    rows.push({ route, file, apiCalls, mockCalls, emptyHandlers, deadLinks })
  }
}

console.log('=== Routes needing attention ===')
for (const r of rows) {
  console.log(`${r.route.padEnd(25)} api=${String(r.apiCalls).padStart(2)} mock=${String(r.mockCalls).padStart(2)} empty=${String(r.emptyHandlers).padStart(2)} dead=${r.deadLinks}`)
}
console.log(`\nTotal routes needing attention: ${rows.length} / ${files.length}`)
