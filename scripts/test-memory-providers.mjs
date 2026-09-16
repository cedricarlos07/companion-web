/*
 * A/B — Native vs Mem0 vs Hybrid sur les 4 questions du scénario Moussa → Yann.
 * Mesure : retrieval success, precision@5 (heuristique mots-clés), source
 * correctness, latence, abstentions.
 *
 * Usage : node scripts/test-memory-providers.mjs  (serveur lancé sur :5299)
 */
const BASE = process.env.BASE_URL ?? 'http://localhost:5299'
let cookie = ''

const QUESTIONS = [
  {
    q: "Comment préparons-nous un appel d'offres ?",
    keywords: ['appel', "d'offres", 'cautionnement', 'attestation', 'plateforme'],
    expectedSource: 'procedure-appel-offres',
  },
  {
    q: 'Qui valide les dossiers Orange CI ?',
    keywords: ['ibrahim', 'validation', 'orange'],
    expectedSource: 'orange',
  },
  {
    q: 'Quel est le plafond de remise ?',
    keywords: ['remise', '15', 'validation'],
    expectedSource: 'remise',
  },
  {
    q: 'Quels éléments sont spécifiques au client SOTRA ?',
    keywords: ['sotra', 'trimestrielle', 'trêve', 'paie'],
    expectedSource: 'sotra',
  },
]

const ENGINES = ['native', 'mem0', 'hybrid']

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie')
  if (setCookie) cookie = setCookie.split(';')[0]
  return { status: res.status, data: await res.json().catch(() => null) }
}

function relevanceScore(answer, citations, keywords) {
  const text = `${answer} ${citations.join(' ')}`.toLowerCase()
  const hits = keywords.filter((k) => text.includes(k))
  return hits.length / keywords.length
}

async function main() {
  const login = await api('/auth/login', {
    method: 'POST',
    body: { email: 'ange.niamke@kamaloka.ci', password: 'companion' },
  })
  if (login.status !== 200) {
    console.error('login impossible')
    process.exit(1)
  }

  const table = []
  for (const engine of ENGINES) {
    for (const { q, keywords, expectedSource } of QUESTIONS) {
      const t0 = Date.now()
      const res = await api('/ask', { method: 'POST', body: { question: q, engine } })
      const ms = Date.now() - t0
      const data = res.data ?? {}
      const abstained = Boolean(data.abstained)
      const citations = (data.citations ?? []).map((c) => `${c.title} ${c.documentTitle ?? ''}`).join(' | ')
      const rel = abstained ? 0 : relevanceScore(data.answer ?? '', (data.citations ?? []).map((c) => `${c.title} ${c.documentTitle ?? ''}`), keywords)
      const top5 = (data.citations ?? []).slice(0, 5)
      const precision5 = top5.filter((c) =>
        `${c.title} ${c.documentTitle ?? ''}`.toLowerCase().split(/\W+/).some((w) => keywords.some((k) => w.includes(k.replace(/'/g, '')))),
      ).length / Math.max(1, top5.length)
      const sourceOk = abstained ? false : `${citations} ${data.answer ?? ''}`.toLowerCase().includes(expectedSource.split('-')[0])
      table.push({
        engine,
        q,
        ms,
        abstained,
        citations: (data.citations ?? []).length,
        rel: Math.round(rel * 100),
        precision5: Math.round(precision5 * 100),
        sourceOk,
        confidence: data.confidence ?? 0,
      })
      process.stdout.write(`${engine.padEnd(7)} ${String(ms).padStart(6)}ms rel=${String(Math.round(rel * 100)).padStart(3)}% p@5=${String(Math.round(precision5 * 100)).padStart(3)}% cit=${String((data.citations ?? []).length).padStart(2)} abst=${abstained ? 'OUI' : 'non'} — ${q.slice(0, 40)}\n`)
    }
  }

  console.log('\n━━━ SYNTHÈSE ━━━')
  for (const engine of ENGINES) {
    const rows = table.filter((t) => t.engine === engine)
    const avg = (f) => Math.round(rows.reduce((s, r) => s + r[f], 0) / rows.length)
    console.log(
      `${engine.padEnd(7)} | success ${(rows.filter((r) => !r.abstained).length * 100) / rows.length}% | ` +
        `rel. moy ${avg('rel')}% | p@5 ${avg('precision5')}% | latence ${avg('ms')}ms | ` +
        `source OK ${rows.filter((r) => r.sourceOk).length}/${rows.length}`,
    )
  }
  console.log('\nNote : Mem0 store "memory" est ré-indexé au démarrage du serveur depuis la base Companion (source de vérité).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
