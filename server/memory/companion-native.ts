import type { DbHandle } from '../db/client.js'
import { embed, toPgVectorLiteral } from '../services/embeddings.js'
import type {
  MemoryProvider,
  MemoryProviderHealth,
  MemoryProviderRecord,
  ProviderAddInput,
  ProviderSearchInput,
} from './memory-provider.js'

/**
 * CompanionNativeMemoryProvider — encapsule le moteur actuel
 * (colonne embedding + distance cosinus pgvector). Référence de
 * comparaison et filet de repli via MEMORY_SEARCH_ENGINE=native.
 */
export class CompanionNativeMemoryProvider implements MemoryProvider {
  readonly name = 'native' as const

  constructor(private dbh: DbHandle) {}

  async add(_input: ProviderAddInput): Promise<void> {
    // L'indexation native est faite par createMemory/updateMemory même.
  }

  async remove(): Promise<void> {
    // Rien à faire : le statut métier filtre les lignes.
  }

  async search(input: ProviderSearchInput): Promise<MemoryProviderRecord[]> {
    const { vector } = await embed(input.query)
    const topK = Math.min(input.topK ?? 20, 50)
    const rows = await this.dbh.query<{ id: string; title: string; content: string; similarity: string | null }>(
      `SELECT m.id, m.title, m.content,
              1 - (m.embedding <=> '${toPgVectorLiteral(vector)}'::vector) AS similarity
       FROM memories m
       WHERE m.organization_id = '${input.organizationId}'
         AND m.status IN ('verified', 'active', 'candidate', 'contradicted')
         AND m.embedding IS NOT NULL
       ORDER BY m.embedding <=> '${toPgVectorLiteral(vector)}'::vector
       LIMIT ${topK}`,
    )
    return rows
      .map((r) => ({
        companionMemoryId: r.id,
        text: `${r.title} — ${r.content}`,
        score: Number(r.similarity ?? 0),
      }))
      .filter((r) => (input.threshold ? r.score >= input.threshold : true))
  }

  async health(): Promise<MemoryProviderHealth> {
    const rows = await this.dbh
      .query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM memories WHERE embedding IS NOT NULL`)
      .catch(() => [{ cnt: '0' }])
    return {
      provider: 'native',
      ok: true,
      detail: `${rows[0]?.cnt ?? 0} mémoires indexées (pgvector via PGlite/Postgres)`,
    }
  }

  async count(): Promise<number> {
    const rows = await this.dbh
      .query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM memories WHERE embedding IS NOT NULL`)
      .catch(() => [])
    return Number(rows[0]?.cnt ?? 0)
  }
}
