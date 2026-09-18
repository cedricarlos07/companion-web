import { config } from '../config.js'
import type { DbHandle } from '../db/client.js'
import { getAiSettings } from '../ai-settings.js'
import { CompanionNativeMemoryProvider } from './companion-native.js'
import { Mem0MemoryProvider } from './mem0-provider.js'
import type { MemoryProvider } from './memory-provider.js'

export type MemorySearchEngine = 'native' | 'mem0' | 'hybrid' | 'fusion'

/**
 * Sélection du moteur mémoire :
 *   MEMORY_SEARCH_ENGINE = native | mem0 | hybrid (défaut)
 *   MEM0_VECTOR_STORE    = memory (dev) | pgvector (prod)
 *   MEM0_PG_DSN          = DSN PostgreSQL (prod, vector store pgvector)
 */
export function memorySearchEngine(): MemorySearchEngine {
  // Défaut : fusion = Mem0 principal (search → IDs → Postgres → permissions →
  // reranking) complété par le chemin natif (fallback technique).
  // MEMORY_PROVIDER=mem0 est le défaut produit ; native = fallback/comparaison.
  const provider = (process.env.MEMORY_PROVIDER ?? 'mem0').toLowerCase()
  if (provider === 'native') return 'native'
  const v = (process.env.MEMORY_SEARCH_ENGINE ?? 'fusion').toLowerCase()
  return v === 'native' || v === 'mem0' || v === 'hybrid' ? v : 'fusion'
}

let provider: MemoryProvider | null = null
let reindexed = false

export async function getMemoryProvider(dbh: DbHandle, organizationId: string): Promise<MemoryProvider> {
  if (provider) return provider
  const ai = await getAiSettings(dbh, organizationId)
  if (memorySearchEngine() === 'native') {
    provider = new CompanionNativeMemoryProvider(dbh)
    return provider
  }
  provider = new Mem0MemoryProvider(dbh, organizationId, {
    vectorStore: (process.env.MEM0_VECTOR_STORE as 'memory' | 'pgvector') ?? (dbh.driver === 'pg' ? 'pgvector' : 'memory'),
    chatModel: ai.chatModel,
    embedModel: ai.embedModel,
    embedDim: ai.embedDim,
    pgDsn: process.env.MEM0_PG_DSN,
  })
  return provider
}

/** Ré-indexe les mémoires actives/vérifiées de l'organisation vers le provider Mem0. */
export async function reindexMemoriesFromDb(dbh: DbHandle, organizationId: string, cap = 800): Promise<number> {
  if (memorySearchEngine() === 'native' || reindexed) return 0
  const mem0 = (await getMemoryProvider(dbh, organizationId)) as MemoryProvider
  if (mem0.name !== 'mem0') return 0

  const rows = await dbh
    .query<{
      id: string; type: string; title: string; content: string; scope: string; status: string;
      confidence: number; employee_id: string | null; role_id: string | null; department_id: string | null;
    }>(
      `SELECT id, type, title, content, scope, status, confidence, employee_id, role_id, department_id
       FROM memories
       WHERE organization_id = $1::uuid
         AND status IN ('active', 'verified')
       ORDER BY importance DESC
       LIMIT $2`, [organizationId, cap],
    )
    .catch(() => [])

  let count = 0
  for (const r of rows) {
    await mem0.add({
      companionMemoryId: r.id,
      organizationId,
      text: `${r.title}. ${r.content}`,
      metadata: {
        employeeId: r.employee_id,
        roleId: r.role_id,
        departmentId: r.department_id,
        scope: r.scope,
        type: r.type,
        status: r.status,
        confidence: r.confidence,
        source: 'reindex',
      },
    })
    count++
  }
  reindexed = true
  return count
}

/** Synchronisation best-effort d'une mémoire validée vers le provider Mem0. */
export async function syncMemoryToProvider(
  dbh: DbHandle,
  organizationId: string,
  memory: {
    id: string; type: string; title: string; content: string; scope: string;
    status: string; confidence: number; employeeId?: string | null;
    roleId?: string | null; departmentId?: string | null;
  },
) {
  if (memorySearchEngine() === 'native') return
  const mem0 = await getMemoryProvider(dbh, organizationId)
  if (mem0.name !== 'mem0') return
  await mem0.add({
    companionMemoryId: memory.id,
    organizationId,
    text: `${memory.title}. ${memory.content}`,
    metadata: {
      employeeId: memory.employeeId ?? null,
      roleId: memory.roleId ?? null,
      departmentId: memory.departmentId ?? null,
      scope: memory.scope,
      type: memory.type,
      status: memory.status,
      confidence: memory.confidence,
      source: 'sync',
    },
  })
}

export { config }
