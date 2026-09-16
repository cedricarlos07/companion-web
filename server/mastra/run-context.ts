import type { DbHandle } from '../db/client.js'
import { memoryAccessClause, type MemoryActor } from '../memory/access.js'

/** Contexte d'exécution enregistré par l'API avant le démarrage du workflow. */
export interface RunContext {
  dbh: DbHandle
  organizationId: string
  agentId: string
  runId: string
  initiatorName?: string
}

const registry = new Map<string, RunContext>()

export function registerRunContext(ctx: RunContext) {
  registry.set(ctx.runId, ctx)
}

export function getRunContext(runId: string): RunContext {
  const ctx = registry.get(runId)
  if (!ctx) throw new Error(`contexte de run introuvable pour ${runId} (serveur redémarré ?)`)
  return ctx
}
