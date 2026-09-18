import type { DbHandle } from '../db/client.js'
import { embed, toPgVectorLiteral } from './embeddings.js'
import { ollamaChat, ollamaStatus } from '../providers/ollama.js'
import { memorySearchEngine, getMemoryProvider } from '../memory/index.js'
import { memoryAccessClause, type MemoryActor } from '../memory/access.js'

/**
 * Ask Companion — hybrid retrieval over the Company Brain:
 *   structured filters (type / scope / role / employee)
 *   + pgvector semantic similarity
 *   + importance + confidence + freshness boosting
 * Every answer carries its sources. Insufficient context → explicit abstention,
 * never an invented internal procedure.
 */

export interface AskFilters {
  type?: string
  scope?: string
  roleId?: string
  employeeId?: string
  departmentId?: string
}

export interface AskCitation {
  index: number
  memoryId: string
  title: string
  type: string
  scope: string
  confidence: number
  importance: number
  updatedAt: string
  contributor: string | null
  documentTitle?: string | null
  excerpt?: string | null
}

export interface AskResult {
  question: string
  answer: string
  abstained: boolean
  abstentionReason?: string
  citations: AskCitation[]
  memoriesUsed: { type: string; confidence: number }[]
  confidence: number
  engine: 'llm' | 'extractive'
}

interface ScoredMemory {
  id: string
  type: string
  title: string
  content: string
  scope: string
  status: string
  confidence: number
  importance: number
  contributor: string | null
  updated_at: string
  semantic: number
  text_match?: number
  document_title?: string | null
  excerpt?: string | null
}

export async function askCompanion(
  dbh: DbHandle,
  organizationId: string,
  question: string,
  filters: AskFilters = {},
  actor?: MemoryActor,
  engineOverride?: 'native' | 'mem0' | 'hybrid' | 'fusion',
): Promise<AskResult> {
  const { vector, provider: embedProvider } = await embed(question)
  const access = memoryAccessClause(actor ?? { kind: 'user', organizationId, appRole: 'owner' }, organizationId, 2)

  // $1 = organisation, $2..N = clause d'accès, puis filtres optionnels nullables.
  let n = 1 + access.params.length
  const optParams: unknown[] = []
  const optClauses: string[] = []
  const opt = (clause: (i: number) => string, value: unknown) => {
    n++
    optParams.push(value)
    optClauses.push(clause(n))
  }
  if (filters.type) opt((i) => `m.type = $${i}::text`, filters.type)
  if (filters.scope) opt((i) => `m.scope = $${i}::text`, filters.scope)
  if (filters.roleId) opt((i) => `(m.role_id = $${i}::uuid OR m.employee_id IN (SELECT id FROM employees WHERE role_id = $${i}))`, filters.roleId)
  if (filters.employeeId) opt((i) => `(m.employee_id = $${i}::uuid OR m.contributor = (SELECT first_name || ' ' || last_name FROM employees WHERE id = $${i}))`, filters.employeeId)
  if (filters.departmentId) opt((i) => `m.department_id = $${i}::uuid`, filters.departmentId)
  const whereAccess = {
    text: [
      `m.organization_id = $1::uuid`,
      `m.status IN ('verified', 'active', 'candidate', 'contradicted')`,
      access.text,
      ...optClauses,
    ].join('\n        AND '),
    params: [organizationId, ...access.params, ...optParams],
  }

  // ---- Retrieval : native (pgvector) ou Mem0 → hydratation → ranking Companion ----
  const engine = engineOverride ?? memorySearchEngine()
  const vecA = ++n
  const likeA = ++n
  const vecB = ++n
  const likeB = ++n
  const like = likePattern(question)
  const nativeRows = () =>
    dbh.query<ScoredMemory & { document_title: string | null; excerpt: string | null; text_match: number }>(`
      WITH semantic AS (
        SELECT m.id, 1 - (m.embedding <=> $${vecA}::vector) AS semantic
        FROM memories m
        WHERE ${whereAccess.text}
          AND m.embedding IS NOT NULL
        ORDER BY m.embedding <=> $${vecB}::vector
        LIMIT 40
      )
      SELECT m.id, m.type, m.title, m.content, m.scope, m.status, m.confidence, m.importance,
             m.contributor, m.updated_at::text AS updated_at,
             COALESCE(s.semantic, 0) AS semantic,
             CASE WHEN m.title || ' ' || m.content ILIKE $${likeA} THEN 1 ELSE 0 END AS text_match,
             (SELECT d.title FROM memory_sources ms JOIN documents d ON d.id = ms.document_id
              WHERE ms.memory_id = m.id AND d.title IS NOT NULL LIMIT 1) AS document_title,
             (SELECT ms.excerpt FROM memory_sources ms WHERE ms.memory_id = m.id LIMIT 1) AS excerpt
      FROM memories m
      JOIN semantic s ON s.id = m.id
      ORDER BY (
          COALESCE(s.semantic, 0) * 0.60
        + (CASE WHEN m.title || ' ' || m.content ILIKE $${likeB} THEN 1 ELSE 0 END) * 0.20
        + (m.importance / 100.0) * 0.12
        + (m.confidence / 100.0) * 0.08
      ) DESC
      LIMIT 8
    `, (() => {
      const params: unknown[] = [...whereAccess.params]
      params[vecA - 1] = toPgVectorLiteral(vector)
      params[likeA - 1] = like
      params[vecB - 1] = toPgVectorLiteral(vector)
      params[likeB - 1] = like
      return params
    })())

  let rows: (ScoredMemory & { document_title: string | null; excerpt: string | null; text_match: number })[] = []

  const hydrateByIds = async (ids: string[]) => {
    if (ids.length === 0) return []
    const hydrateAccess = memoryAccessClause(actor ?? { kind: 'user', organizationId, appRole: 'owner' }, organizationId, 2)
    const likeIdx = 2 + hydrateAccess.params.length
    return await dbh.query<ScoredMemory & { document_title: string | null; excerpt: string | null; text_match: number }>(`
          SELECT m.id, m.type, m.title, m.content, m.scope, m.status, m.confidence, m.importance,
                 m.contributor, m.updated_at::text AS updated_at,
                 COALESCE(m.confidence / 100.0, 0) AS semantic,
                 CASE WHEN m.title || ' ' || m.content ILIKE $${likeIdx} THEN 1 ELSE 0 END AS text_match,
                 (SELECT d.title FROM memory_sources ms JOIN documents d ON d.id = ms.document_id
                  WHERE ms.memory_id = m.id AND d.title IS NOT NULL LIMIT 1) AS document_title,
                 (SELECT ms.excerpt FROM memory_sources ms WHERE ms.memory_id = m.id LIMIT 1) AS excerpt
          FROM memories m
          WHERE m.id = ANY($1::uuid[])
            AND ${hydrateAccess.text}
        `, [ids, ...hydrateAccess.params, like])
  }

  if (engine === 'mem0') {
    // Chemin Mem0 seul : retrieval sémantique → hydratation SQL → permission + ranking.
    const memoryProvider = await getMemoryProvider(dbh, organizationId)
    const hits = await memoryProvider.search({ query: question, organizationId, topK: 30 })
    const scoreById = new Map(hits.map((h) => [h.companionMemoryId, h.score]))
    rows = await hydrateByIds(hits.map((h) => h.companionMemoryId))
    for (const r of rows) r.semantic = scoreById.get(r.id) ?? Number(r.semantic)
  } else if (engine === 'fusion') {
    // FUSION : native top 10 + mem0 top 10 → merge par companionMemoryId (score max)
    // → dédup → reranking Companion (déjà appliqué par les clauses de tri + scored) → top 8.
    const memoryProvider = await getMemoryProvider(dbh, organizationId)
    const [nativeHits, mem0Hits] = await Promise.all([
      nativeRows(),
      memoryProvider.search({ query: question, organizationId, topK: 10 }).then(async (hits) => {
        const scoreById = new Map(hits.map((h) => [h.companionMemoryId, h.score]))
        const hydrated = await hydrateByIds(hits.map((h) => h.companionMemoryId))
        for (const r of hydrated) r.semantic = scoreById.get(r.id) ?? Number(r.semantic)
        return hydrated
      }),
    ])
    const merged = new Map<string, ScoredMemory & { document_title: string | null; excerpt: string | null; text_match: number }>()
    for (const r of [...nativeHits, ...mem0Hits]) {
      const existing = merged.get(r.id)
      if (!existing || r.semantic > existing.semantic) merged.set(r.id, r)
    }
    rows = [...merged.values()]
  } else {
    rows = await nativeRows()
  }
  void embedProvider

  const scored = rows
    .map((r) => ({
      ...r,
      hybrid: Number(r.semantic) * 0.55 + Number(r.text_match) * 0.2 + (r.importance / 100) * 0.13 + (r.confidence / 100) * 0.07 + 0.05 * freshnessScore(r.updated_at),
    }))
    .sort((a, b) => b.hybrid - a.hybrid)

  if (scored.length === 0 || (scored[0]?.semantic < 0.2 && scored[0]?.text_match === 0)) {
    return {
      question,
      answer:
        "Je ne dispose pas d'assez d'informations fiables dans la mémoire de l'entreprise pour répondre à cette question. Importez une source ou documentez cette connaissance, puis redemandez — je préfère m'abstenir plutôt que d'inventer une procédure interne.",
      abstained: true,
      abstentionReason: 'contexte insuffisant',
      citations: [],
      memoriesUsed: [],
      confidence: 0,
      engine: 'extractive',
    }
  }

  const top = scored.slice(0, 6)
  const citations: AskCitation[] = top.map((m, i) => ({
    index: i + 1,
    memoryId: m.id,
    title: m.title,
    type: m.type,
    scope: m.scope,
    confidence: m.confidence,
    importance: m.importance,
    updatedAt: m.updated_at,
    contributor: m.contributor,
    documentTitle: m.document_title,
    excerpt: m.excerpt,
  }))

  const memoriesUsed = groupMemoryTypes(top)
  const answerConfidence = Math.round(
    Math.min(96, (top[0].confidence + (top[0].status === 'verified' ? 8 : 0) + top.reduce((s, m) => s + m.confidence, 0) / top.length) / 2 + top.length * 2),
  )

  const llm = await ollamaStatus()
  if (llm.available) {
    const contextBlock = top
      .map((m, i) => `[${i + 1}] (${m.type}, confiance ${m.confidence} %, statut ${m.status}) ${m.title} — ${m.content}`)
      .join('\n\n')
    const answer = await ollamaChat([
      {
        role: 'system',
        content:
          "Tu es Companion, la mémoire opérationnelle d'une entreprise. Réponds en français professionnel, de façon factuelle et concise (5 phrases maximum). Utilise UNIQUEMENT le contexte fourni. Cite tes sources avec les numéros [1], [2]… Si le contexte ne suffit pas, dis-le clairement et refuse d'inventer.",
      },
      {
        role: 'user',
        content: `Question : ${question}\n\nContexte issu de la mémoire validée :\n${contextBlock}`,
      },
    ])
    if (answer && answer.trim().length > 20) {
      return {
        question,
        answer: answer.trim(),
        abstained: false,
        citations,
        memoriesUsed,
        confidence: answerConfidence,
        engine: 'llm',
      }
    }
  }

  // Extractive fallback — assembles a sourced answer from the memories themselves.
  const answer = buildExtractiveAnswer(question, top)
  return { question, answer, abstained: false, citations, memoriesUsed, confidence: answerConfidence, engine: 'extractive' }
}

function buildExtractiveAnswer(question: string, top: ScoredMemory[]): string {
  const intro = `Voici ce que la mémoire de l'entreprise contient à propos de « ${question.replace(/[?«»]/g, '').trim()} » :`
  const body = top
    .map((m, i) => {
      const label =
        m.type === 'procedure' ? 'Procédure' :
        m.type === 'decision' ? 'Décision' :
        m.type === 'relationship' ? 'Relation' :
        m.type === 'lesson' ? 'Leçon' :
        m.type === 'preference' ? 'Préférence' :
        m.type === 'project' ? 'Projet' :
        m.type === 'handover' ? 'Transfert' : 'Fait'
      const src = m.document_title ? ` (source : ${m.document_title})` : ''
      return `[${i + 1}] ${label} — ${m.content} — connaissance « ${m.title} », confiance ${m.confidence} %${src}.`
    })
    .join('\n\n')
  const verified = top.filter((m) => m.status === 'verified').length
  const closing = verified > 0
    ? `${verified} de ces connaissances sont vérifiées par un humain.`
    : 'Aucune de ces connaissances n\'est encore vérifiée par un humain — faites-les valider pour renforcer la réponse.'
  return `${intro}\n\n${body}\n\n${closing}`
}

function groupMemoryTypes(top: ScoredMemory[]): { type: string; confidence: number }[] {
  const byType = new Map<string, number[]>()
  for (const m of top) {
    const list = byType.get(m.type) ?? []
    list.push(m.confidence)
    byType.set(m.type, list)
  }
  return [...byType.entries()].map(([type, confs]) => ({
    type: typeLabel(type),
    confidence: Math.round(confs.reduce((s, c) => s + c, 0) / confs.length),
  }))
}

function typeLabel(type: string): string {
  return {
    fact: 'Fait', decision: 'Décision', procedure: 'Procédure', relationship: 'Relation',
    preference: 'Préférence', lesson: 'Leçon', project: 'Projet', handover: 'Transfert',
  }[type] ?? type
}

function freshnessScore(updatedAt: string): number {
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86_400_000
  if (days <= 7) return 1
  if (days <= 90) return 0.8
  if (days <= 365) return 0.5
  return 0.2
}

function likePattern(q: string): string {
  const words = q
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 5)
  if (words.length === 0) return '%__none__%'
  return `%${words.join('%')}%`
}
