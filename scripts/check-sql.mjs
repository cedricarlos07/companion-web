/**
 * SCAN SQL — gate CI.
 *
 * Règle : AUCUNE requête SQL construite par concaténation dynamique.
 *
 * Détecte toute interpolation `${…}` à l'intérieur d'un template literal
 * passé à `query(…)` ou `exec(…)` dans server/ (y compris les fragments SQL
 * construits dans des variables puis composés — détectés via les mots-clés
 * SQL dans le template).
 *
 * Exclusions explicites (bootstrap-only, hors surface HTTP, contenu statique) :
 *   - server/seed.ts, server/db/migrations, server/dbmigrate.ts
 *
 * Tout le reste doit passer par les placeholders $1, $2… du driver
 * (voir server/db/client.ts — query/exec acceptent un tableau de params).
 *
 * Usage : node scripts/check-sql.mjs   (exit 1 si violation)
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('server')
const EXCLUDED_FILES = new Set([
  'seed.ts',
  'dbmigrate.ts',
])

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (entry.name.endsWith('.ts')) yield p
  }
}

/** Retourne les blocs template literal contenant ${…} et du SQL. */
function findViolations(src) {
  const violations = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "'" || c === '"') {
      // sauter les chaînes classiques
      const quote = c
      i++
      while (i < src.length) {
        if (src[i] === '\\') { i += 2; continue }
        if (src[i] === quote) break
        i++
      }
      i++
      continue
    }
    if (c === '/' && src[i + 1] === '/') {
      while (i < src.length && src[i] !== '\n') i++
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      i += 2
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++
      i += 2
      continue
    }
    if (c === '`') {
      const tick = i
      let j = tick + 1
      let hasInterp = false
      const interps = []
      while (j < src.length) {
        const ch = src[j]
        if (ch === '\\') { j += 2; continue }
        if (ch === '`') break
        if (ch === '$' && src[j + 1] === '{') {
          hasInterp = true
          const precededByDollar = j > tick + 1 && src[j - 1] === '$'
          let depth = 1
          const exprStart = j + 2
          j += 2
          while (j < src.length && depth > 0) {
            const c2 = src[j]
            if (c2 === "'" || c2 === '"' || c2 === '`') {
              const q = c2
              j++
              while (j < src.length) {
                if (src[j] === '\\') { j += 2; continue }
                if (src[j] === q) break
                j++
              }
            } else if (c2 === '{') depth++
            else if (c2 === '}') depth--
            j++
          }
          interps.push({ expr: src.slice(exprStart, j - 1).replace(/\s+/g, ' '), precededByDollar })
          continue
        }
        j++
      }
      const content = src.slice(tick, j)
      const hasSql = /\b(select|insert|update|delete|values|where|from|order\s+by|ilike|returning)\b/i.test(content)
      const quoted = hasQuotedPlaceholder(content)
      if (hasInterp && hasSql && (!allInterpsSafe(interps) || quoted) && !hasIdentMarker(src, tick)) {
        const line = src.slice(0, tick).split('\n').length
        const bad = interps.filter((ip) => !isSafeInterp(ip)).map((ip) => ip.expr)
        if (quoted) bad.push('placeholder dans un littéral quoté')
        violations.push({ line, snippet: content.slice(0, 100).replaceAll('\n', ' '), bad })
      }
      i = j
      continue
    }
    i++
  }
  return violations
}

/** Interpolation sûre : numéro de placeholder calculé ($${n}), fragment
 *  paramétré (x.text), ou compteur next() de la couche d'accès. */
function isSafeInterp(ip) {
  if (ip.precededByDollar) return true
  if (ip.expr.endsWith('.text')) return true
  if (ip.expr === 'next()') return true
  return false
}

/** Placeholder enfermé dans un littéral (quotes JSON/SQL) : `'"$1"'` — le
 *  texte du placeholder devient une valeur littérale, jamais un paramètre. */
function hasQuotedPlaceholder(content) {
  return /'\s*"\s*\$[\d{]/.test(content) || /'\$\d+'/.test(content)
}

function allInterpsSafe(interps) {
  return interps.every(isSafeInterp)
}

function hasIdentMarker(src, tick) {
  // marqueur `sql:ident` sur la ligne précédente OU en commentaire SQL dans le template
  const before = src.slice(0, tick).split('\n')
  if ((before[before.length - 1] ?? '').includes('sql:ident')) return true
  if ((before[before.length - 2] ?? '').includes('sql:ident')) return true
  const close = src.indexOf('`', tick + 1)
  let content = src.slice(tick, close === -1 ? src.length : close)
  if (content.length > 400) content = content.slice(0, 400)
  return content.includes('sql:ident')
}

const offenders = []
const badExprs = []
for (const file of walk(ROOT)) {
  const rel = path.relative(process.cwd(), file).replaceAll('\\', '/')
  if (EXCLUDED_FILES.has(path.basename(file))) continue
  const src = fs.readFileSync(file, 'utf8')
  for (const v of findViolations(src)) {
    offenders.push(`${rel}:${v.line}  ${v.snippet}…`)
    for (const b of v.bad ?? []) badExprs.push(`${rel}:${v.line} → \${${b}}`)
  }
}

if (offenders.length > 0) {
  console.error(`💥 SQL CHECK : ${offenders.length} requête(s) construite(s) par interpolation.`)
  console.error('    Règle : toute valeur passe par un placeholder $n + tableau de params (server/db/client.ts).')
  for (const o of offenders) console.error('    - ' + o)
  for (const b of badExprs) console.error('      · interpolation non sûre : ' + b)
  process.exit(1)
}
console.log(`🏆 SQL CHECK : aucune interpolation dynamique dans server/ (seed/migrations exclus).`)
