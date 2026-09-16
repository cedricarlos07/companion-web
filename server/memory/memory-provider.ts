/**
 * MemoryProvider — abstraction entre Companion et les moteurs mémoire.
 *
 * Règles d'architecture :
 * - Le reste du code Companion (Handover, Role Brain, Ask, Risk, Agents)
 *   n'importe JAMAIS mem0ai directement : tout passe par ce contrat.
 * - La base PostgreSQL Companion reste la source de vérité métier
 *   (statuts, versions, provenance, permissions). Le provider est une
 *   couche d'indexation/récupération.
 * - Toute recherche porte AU MINIMUM le organization_id ; le contrôle
 *   d'accès définitif est refait par Companion après hydratation.
 */

export interface ProviderAddInput {
  companionMemoryId: string
  organizationId: string
  text: string
  metadata: {
    employeeId?: string | null
    roleId?: string | null
    departmentId?: string | null
    scope: string
    type: string
    status: string
    confidence: number
    source?: string
    [key: string]: unknown
  }
}

export interface ProviderSearchInput {
  query: string
  organizationId: string
  topK?: number
  threshold?: number
}

export interface MemoryProviderRecord {
  companionMemoryId: string
  text: string
  score: number
}

export interface MemoryProviderHealth {
  provider: 'native' | 'mem0'
  ok: boolean
  detail: string
  latencyMs?: number
  vectorStore?: string
  llm?: string
  embedder?: string
  lastError?: string
}

export interface MemoryProvider {
  readonly name: 'native' | 'mem0'
  add(input: ProviderAddInput): Promise<void>
  remove(companionMemoryId: string, organizationId: string): Promise<void>
  search(input: ProviderSearchInput): Promise<MemoryProviderRecord[]>
  health(): Promise<MemoryProviderHealth>
  /** Nombre d'éléments indexés (best-effort, 0 si non supporté). */
  count(): Promise<number>
}
