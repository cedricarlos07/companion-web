import type { DbHandle } from '../db/client.js'
import { config } from '../config.js'
import type {
  MemoryProvider,
  MemoryProviderHealth,
  MemoryProviderRecord,
  ProviderAddInput,
  ProviderSearchInput,
} from './memory-provider.js'

/**
 * Mem0MemoryProvider — Mem0 OSS comme runtime d'indexation/récupération.
 *
 * - Store : "memory" en dev (éphémère → auto-reindex depuis la base
 *   Companion, qui reste la source de vérité) ; "pgvector" en production.
 * - LLM + embedder : Ollama local (BYOK).
 * - `infer: false` : Companion gère déjà le sens métier — Mem0 stocke le
 *   texte FAITHFUL tel quel, sans consolidation/réécriture LLM.
 * - Scoping : `userId = organizationId` (filtre natif toujours appliqué).
 *   Les autres scopes (employee/role/department/type) vivent en metadata
 *   et sont RE-FILTRÉS par Companion après hydratation.
 */

const CUSTOM_INSTRUCTIONS = `Ces textes sont des connaissances professionnelles déjà validées d'une entreprise.
Ne pas reformuler, ne pas déduire, ne pas fusionner : stocker chaque connaissance telle quelle.
Langue : français.`

export class Mem0MemoryProvider implements MemoryProvider {
  readonly name = 'mem0' as const
  private memory: import('mem0ai/oss').Memory | null = null
  private initPromise: Promise<void> | null = null
  lastError: string | undefined

  constructor(
    private dbh: DbHandle,
    private organizationId: string,
    private options: {
      vectorStore: 'memory' | 'pgvector'
      chatModel: string
      embedModel: string
      embedDim: number
      pgDsn?: string
    },
  ) {}

  private async ensureInit() {
    if (this.memory) return
    if (this.initPromise) return this.initPromise
    this.initPromise = (async () => {
      // Import dynamique : le reste de Companion n'importe jamais mem0ai directement.
      const oss = (await import('mem0ai/oss')) as unknown as {
        Memory: new (cfg: unknown) => import('mem0ai/oss').Memory
      }
      const vectorStore =
        this.options.vectorStore === 'pgvector'
          ? {
              provider: 'pgvector',
              config: {
                dsn: this.options.pgDsn,
                collectionName: 'companion_memories',
                dimension: this.options.embedDim,
              },
            }
          : { provider: 'memory', config: { collectionName: 'companion_memories' } }

      this.memory = new oss.Memory({
        embedder: {
          provider: 'ollama',
          config: {
            model: this.options.embedModel,
            baseURL: config.ollamaUrl,
            url: config.ollamaUrl,
            embeddingDims: this.options.embedDim,
          },
        },
        vectorStore,
        llm: {
          provider: 'ollama',
          config: { model: this.options.chatModel, baseURL: config.ollamaUrl },
        },
        disableHistory: true,
        customInstructions: CUSTOM_INSTRUCTIONS,
      } as never)
    })()
    return this.initPromise
  }

  async add(input: ProviderAddInput): Promise<void> {
    await this.ensureInit()
    try {
      await this.memory!.add(
        `${input.metadata.type ?? 'connaissance'} : ${input.text}`,
        {
          userId: input.organizationId,
          metadata: {
            companionMemoryId: input.companionMemoryId,
            employee_id: input.metadata.employeeId ?? null,
            role_id: input.metadata.roleId ?? null,
            department_id: input.metadata.departmentId ?? null,
            scope: input.metadata.scope,
            type: input.metadata.type,
            status: input.metadata.status,
            confidence: input.metadata.confidence,
          },
          infer: false,
        },
      )
      this.lastError = undefined
    } catch (err) {
      this.lastError = String(err).slice(0, 300)
      console.error('[mem0] ERREUR add — Memory DEGRADED:', this.lastError)
      // Une erreur Mem0 ne bloque pas le métier mais EST journalisée visiblement.
    }
  }

  async remove(companionMemoryId: string, organizationId: string): Promise<void> {
    // V1 : pas de suppression par metadata dans le store memory — les
    // entrées périmées sont neutralisées par le re-filtrage de statut
    // côté Companion après hydratation. (pgvector en prod : idem.)
    void companionMemoryId
    void organizationId
  }

  async search(input: ProviderSearchInput): Promise<MemoryProviderRecord[]> {
    await this.ensureInit()
    if (!this.memory) return []
    try {
      const result = await this.memory.search(input.query, {
        filters: { user_id: input.organizationId },
        topK: Math.min(input.topK ?? 20, 50),
        threshold: input.threshold,
      } as never)
      const out: MemoryProviderRecord[] = []
      for (const item of result.results ?? []) {
        const meta = (item.metadata ?? {}) as Record<string, unknown>
        const cid = meta.companionMemoryId as string | undefined
        if (!cid) continue
        out.push({
          companionMemoryId: cid,
          text: item.memory,
          score: Number(item.score ?? 0),
        })
      }
      this.lastError = undefined
      return out
    } catch (err) {
      this.lastError = String(err).slice(0, 300)
      console.error('[mem0] ERREUR retrieval — Memory DEGRADED:', this.lastError)
      throw new Error(`Memory degraded: ${this.lastError}`)
    }
  }

  async health(): Promise<MemoryProviderHealth> {
    const start = Date.now()
    try {
      await this.ensureInit()
      await this.memory!.search('healthcheck', { filters: { user_id: this.organizationId }, topK: 1 } as never)
      return {
        provider: 'mem0',
        ok: true,
        detail: `Mem0 opérationnel (store ${this.options.vectorStore})`,
        latencyMs: Date.now() - start,
        vectorStore: this.options.vectorStore,
        llm: this.options.chatModel,
        embedder: this.options.embedModel,
        lastError: this.lastError,
      }
    } catch (err) {
      return {
        provider: 'mem0',
        ok: false,
        detail: 'Mem0 indisponible — bascule native possible via MEMORY_SEARCH_ENGINE=native',
        latencyMs: Date.now() - start,
        vectorStore: this.options.vectorStore,
        llm: this.options.chatModel,
        embedder: this.options.embedModel,
        lastError: String(err).slice(0, 300),
      }
    }
  }

  async count(): Promise<number> {
    // Le store memory n'expose pas de comptage — best-effort par recherche large.
    try {
      await this.ensureInit()
      const r = await this.memory!.search('connaissance procédure décision client', {
        filters: { user_id: this.organizationId },
        topK: 100,
      } as never)
      return (r.results ?? []).length
    } catch {
      return 0
    }
  }
}
