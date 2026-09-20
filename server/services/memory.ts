import { and, eq, ne, sql } from 'drizzle-orm'
import type { DbHandle } from '../db/client.js'
import { memories, memorySources, memoryVersions, memoryLinks } from '../db/schema.js'
import { embed, localEmbed, toPgVectorLiteral } from './embeddings.js'

export type MemoryType =
  | 'fact' | 'decision' | 'procedure' | 'relationship'
  | 'preference' | 'lesson' | 'project' | 'handover'

export type MemoryScope = 'employee' | 'role' | 'department' | 'company' | 'restricted'

export type MemoryStatus =
  | 'candidate' | 'verified' | 'active' | 'contradicted'
  | 'superseded' | 'deprecated' | 'rejected'

export interface CreateMemoryInput {
  organizationId: string
  type: MemoryType
  title: string
  content: string
  scope?: MemoryScope
  employeeId?: string | null
  roleId?: string | null
  departmentId?: string | null
  confidence?: number
  importance?: number
  status?: MemoryStatus
  validFrom?: string | null
  contributor?: string
  origin?: 'llm' | 'heuristic' | 'human' | 'interview'
  humanValidated?: boolean
  /** Provenance — where this memory comes from */
  source?: {
    documentId?: string | null
    chunkId?: string | null
    excerpt?: string
    location?: string
  }
  changedBy?: string
  skipDedup?: boolean
}

export interface DedupVerdict {
  duplicateOfId?: string
  contradictsId?: string
  similarity: number
  action: 'create' | 'confirm' | 'flag-contradiction'
}

const DUPLICATE_THRESHOLD = 0.93
const CONTRADICTION_CANDIDATE_THRESHOLD = 0.82

/**
 * Creates a memory with full provenance, versioning snapshot, dedup and
 * contradiction detection. Low-confidence extractions always land as
 * `candidate` — they never silently become truth.
 */
export async function createMemory(dbh: DbHandle, input: CreateMemoryInput) {
  const text = `${input.title}\n${input.content}`
  const { vector, provider } = await embed(text)

  // Low-confidence extractions can never be auto-verified.
  let status: MemoryStatus = input.status ?? 'candidate'
  if ((input.origin === 'llm' || input.origin === 'heuristic') && !input.humanValidated) {
    status = status === 'verified' ? 'candidate' : status
  }

  let verdict: DedupVerdict = { similarity: 0, action: 'create' }
  if (!input.skipDedup) {
    verdict = await checkDeduplication(dbh, input.organizationId, input.type, vector, input.title, input.employeeId ?? null)
    if (verdict.action === 'confirm') {
      // Same knowledge re-observed → bump confidence slightly on the original.
      await dbh.db
        .update(memories)
        .set({
          confidence: sql`LEAST(99, ${memories.confidence} + 2)`,
          updatedAt: new Date(),
        })
        .where(eq(memories.id, verdict.duplicateOfId!))
      if (input.source?.documentId || input.source?.chunkId) {
        await dbh.db.insert(memorySources).values({
          memoryId: verdict.duplicateOfId!,
          documentId: input.source.documentId ?? null,
          chunkId: input.source.chunkId ?? null,
          excerpt: input.source.excerpt ?? null,
          location: input.source.location ?? null,
        })
      }
      const existing = await dbh.query<{ id: string }>(
        `SELECT id FROM memories WHERE id = $1::uuid`, [verdict.duplicateOfId],
      )
      return { memory: existing[0] ?? null, verdict, created: false }
    }
  }

  const confidence = Math.max(1, Math.min(99, input.confidence ?? 50))
  const importance = Math.max(1, Math.min(100, input.importance ?? 50))

  const [created] = await dbh.db
    .insert(memories)
    .values({
      organizationId: input.organizationId,
      type: input.type,
      title: input.title,
      content: input.content,
      scope: input.scope ?? 'company',
      employeeId: input.employeeId ?? null,
      roleId: input.roleId ?? null,
      departmentId: input.departmentId ?? null,
      status,
      confidence,
      importance,
      validFrom: input.validFrom ?? null,
      contributor: input.contributor ?? null,
      origin: input.origin ?? 'human',
      humanValidated: input.humanValidated ?? false,
      embedding: sql`${toPgVectorLiteral(vector)}::vector`,
      embeddingProvider: provider,
    })
    .returning()

  // Version 1 snapshot — no correction ever overwrites history silently.
  await dbh.db.insert(memoryVersions).values({
    memoryId: created.id,
    version: 1,
    title: created.title,
    content: created.content,
    status: created.status,
    confidence: created.confidence,
    importance: created.importance,
    changedBy: input.changedBy ?? input.contributor ?? 'system',
    changeReason: 'création',
  })

  if (input.source?.documentId || input.source?.chunkId) {
    await dbh.db.insert(memorySources).values({
      memoryId: created.id,
      documentId: input.source.documentId ?? null,
      chunkId: input.source.chunkId ?? null,
      excerpt: input.source.excerpt ?? null,
      location: input.source.location ?? null,
    })
  }

  if (verdict.action === 'flag-contradiction' && verdict.contradictsId) {
    await dbh.db.insert(memoryLinks).values({
      fromMemoryId: created.id,
      toMemoryId: verdict.contradictsId,
      kind: 'contradicts',
    })
    // Both sides become visibly `contradicted` until a human resolves.
    await dbh.db
      .update(memories)
      .set({ status: 'contradicted' })
      .where(eq(memories.id, verdict.contradictsId))
    await dbh.db.update(memories).set({ status: 'contradicted' }).where(eq(memories.id, created.id))
  }

  return { memory: created, verdict, created: true }
}

async function checkDeduplication(
  dbh: DbHandle,
  organizationId: string,
  type: MemoryType,
  vector: number[],
  title: string,
  employeeId: string | null,
): Promise<DedupVerdict> {
  // Le périmètre de déduplication est le propriétaire : la même connaissance
  // détenue par DEUX employés n'est pas un doublon à fusionner — c'est du
  // coverage (le moteur de risque compte les doublons inter-titulaires).

  const candidates = await dbh.query<{ id: string; title: string; embedding: string | null; similarity: number }>(`
    SELECT m.id, m.title, m.embedding::text AS embedding,
           1 - (m.embedding <=> $1::vector) AS similarity
    FROM memories m
    WHERE m.organization_id = $2::uuid
      AND m.type = $3
      AND m.status NOT IN ('rejected', 'superseded', 'deprecated')
      AND ($4::text IS NULL OR m.employee_id = $4::uuid OR m.employee_id IS NULL)
      AND m.embedding IS NOT NULL
    ORDER BY m.embedding <=> $5::vector
    LIMIT 5
  `, [toPgVectorLiteral(vector), organizationId, type, employeeId ?? null, toPgVectorLiteral(vector)])

  let best: DedupVerdict = { similarity: 0, action: 'create' }
  for (const c of candidates) {
    const similarity = Number(c.similarity ?? 0)
    if (similarity >= DUPLICATE_THRESHOLD) {
      return { duplicateOfId: c.id, similarity, action: 'confirm' }
    }
    if (similarity >= CONTRADICTION_CANDIDATE_THRESHOLD && similarity > best.similarity) {
      best = { contradictsId: c.id, similarity, action: 'flag-contradiction' }
    }
  }
  // Same-title exact match (LLM re-extraction) counts as duplicate regardless of vector.
  const exact = await dbh.query<{ id: string }>(
    `SELECT id FROM memories WHERE organization_id = $1::uuid AND type = $2 AND lower(title) = $3
       AND ($4::text IS NULL OR employee_id = $4::uuid OR employee_id IS NULL) LIMIT 1`,
    [organizationId, type, title.toLowerCase(), employeeId ?? null],
  )
  if (exact[0]) return { duplicateOfId: exact[0].id, similarity: 1, action: 'confirm' }
  return best
}

/** Updates a memory — writes a new version, never overwrites history. */
export async function updateMemory(
  dbh: DbHandle,
  memoryId: string,
  patch: { title?: string; content?: string; status?: MemoryStatus; confidence?: number; importance?: number },
  changedBy: string,
  changeReason: string,
) {
  const rows = await dbh.query<{ id: string; version: number; title: string; content: string; status: string; confidence: number; importance: number }>(
    `SELECT id, version, title, content, status, confidence, importance FROM memories WHERE id = $1::uuid`, [memoryId],
  )
  const existing = rows[0]
  if (!existing) return null

  const nextVersion = existing.version + 1
  await dbh.db
    .update(memories)
    .set({
      title: patch.title ?? existing.title,
      content: patch.content ?? existing.content,
      status: patch.status ?? (existing.status as MemoryStatus),
      confidence: patch.confidence ?? existing.confidence,
      importance: patch.importance ?? existing.importance,
      version: nextVersion,
      updatedAt: new Date(),
      humanValidated: patch.status === 'verified' ? true : undefined,
    })
    .where(eq(memories.id, memoryId))

  await dbh.db.insert(memoryVersions).values({
    memoryId,
    version: nextVersion,
    title: patch.title ?? existing.title,
    content: patch.content ?? existing.content,
    status: patch.status ?? existing.status,
    confidence: patch.confidence ?? existing.confidence,
    importance: patch.importance ?? existing.importance,
    changedBy,
    changeReason,
  })

  if (patch.status === 'verified' || patch.status === 'active') {
    await dbh.db
      .update(memories)
      .set({ status: patch.status })
      .where(and(eq(memories.id, memoryId), ne(memories.status, patch.status)))
  }

  // Re-embed when content changed materially.
  if (patch.content && patch.content !== existing.content) {
    const { vector, provider } = await embed(`${patch.title ?? existing.title}\n${patch.content}`)
    await dbh.db
      .update(memories)
      .set({ embedding: sql`${toPgVectorLiteral(vector)}::vector`, embeddingProvider: provider })
      .where(eq(memories.id, memoryId))
  }

  // Sync vers le provider mémoire (Mem0) quand la mémoire devient fiable.
  if (patch.status === 'verified' || patch.status === 'active') {
    const rowsAfter = await dbh.query<{
      id: string; type: string; title: string; content: string; scope: string; status: string;
      confidence: number; employee_id: string | null; role_id: string | null; department_id: string | null;
      organization_id: string;
    }>(`SELECT * FROM memories WHERE id = $1::uuid`, [memoryId])
    const after = rowsAfter[0]
    if (after) {
      const { syncMemoryToProvider } = await import('../memory/index.js')
      await syncMemoryToProvider(dbh, after.organization_id, {
        id: after.id, type: after.type, title: after.title, content: after.content,
        scope: after.scope, status: after.status, confidence: after.confidence,
        employeeId: after.employee_id, roleId: after.role_id, departmentId: after.department_id,
      })
    }
  }

  const updated = await dbh.query(`SELECT * FROM memories WHERE id = $1::uuid`, [memoryId])
  return updated[0]
}

/** Promotes an employee-scoped memory into the Role Brain (keeps provenance). */
export async function promoteToRole(
  dbh: DbHandle,
  memoryId: string,
  roleId: string,
  changedBy: string,
) {
  const rows = await dbh.query<{ scope: string; role_id: string | null; type: string; title: string; content: string }>(
    `SELECT scope, role_id, type, title, content FROM memories WHERE id = $1::uuid`, [memoryId],
  )
  const m = rows[0]
  if (!m) return null
  if (m.scope === 'employee' && !isDurableType(m.type as MemoryType)) {
    // Personal / non-transmissible knowledge is never auto-promoted.
    return { promoted: false, reason: 'non-durable' }
  }
  await updateMemory(
    dbh,
    memoryId,
    { status: 'active' },
    changedBy,
    `promotion au Role Brain (${roleId})`,
  )
  await dbh.db
    .update(memories)
    .set({ roleId, scope: 'role' })
    .where(eq(memories.id, memoryId))
  return { promoted: true }
}

/** Durable knowledge types eligible for the Role Brain. */
export function isDurableType(type: MemoryType): boolean {
  return ['procedure', 'decision', 'fact', 'lesson', 'project', 'preference'].includes(type)
}

export { localEmbed }
