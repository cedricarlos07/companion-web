import { z } from 'zod'
import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { apRequest, type ActivepiecesConfig } from './bootstrap.js'

/**
 * Connection Reconciler — détecte automatiquement quand une connexion
 * Activepieces devient ACTIVE, l'injecte dans le flow correspondant,
 * puis publie le flow. Le client ne fait que le consentement OAuth.
 */

interface ApConnection {
  id: string
  displayName: string
  pieceName: string
  status: string
}

interface ApFlow {
  id: string
  displayName: string
  status: 'DISABLED' | 'ENABLED'
  version?: {
    trigger?: {
      settings?: {
        pieceName?: string
        input?: Record<string, unknown>
      }
    }
  }
}

export interface ReconcileResult {
  connectedPieces: string[]
  activatedFlows: string[]
  alreadyActive: string[]
}

/**
 * Reconciler principal :
 *   1. Liste les connexions ACTIVE dans Activepieces
 *   2. Trouve les flows DISABLED dont le trigger piece a une connexion ACTIVE
 *   3. Injecte la connexion dans le trigger du flow
 *   4. Active le flow
 *   5. Journalise
 */
export async function reconcileConnections(
  dbh: DbHandle,
  organizationId: string,
  cfg: ActivepiecesConfig,
): Promise<ReconcileResult> {
  const [connectionsRes, flowsRes] = await Promise.all([
    apRequest<{ data: ApConnection[] }>(cfg, 'GET', `/app-connections?projectId=${cfg.projectId}&limit=100`),
    apRequest<{ data: ApFlow[] }>(cfg, 'GET', `/flows?projectId=${cfg.projectId}&limit=100`),
  ])

  const activeConnections = (connectionsRes.data ?? []).filter((c) => c.status === 'ACTIVE')
  const activePieceNames = new Set(activeConnections.map((c) => c.pieceName))
  const connectionByPiece = new Map<string, ApConnection>()
  for (const c of activeConnections) connectionByPiece.set(c.pieceName, c)

  const activatedFlows: string[] = []
  const alreadyActive: string[] = []
  const connectedPieces = [...activePieceNames]

  for (const flow of flowsRes.data ?? []) {
    const triggerPiece = flow.version?.trigger?.settings?.pieceName
    if (!triggerPiece) continue

    // Le flow a-t-il déjà été activé ?
    if (flow.status === 'ENABLED') {
      alreadyActive.push(flow.displayName)
      continue
    }

    // Le flow a-t-il une connexion ACTIVE pour son trigger piece ?
    if (!activePieceNames.has(triggerPiece)) continue

    // Oui → injecter la connexion et activer le flow.
    const connection = connectionByPiece.get(triggerPiece)
    if (!connection) continue

    try {
      // PATCH le flow pour injecter la connexion dans le trigger et l'activer.
      const updatedVersion = {
        ...flow.version,
        trigger: {
          ...flow.version?.trigger,
          settings: {
            ...flow.version?.trigger?.settings,
            input: {
              ...flow.version?.trigger?.settings?.input,
              connectionId: connection.id,
            },
          },
        },
      }

      await apRequest(cfg, 'PATCH', `/flows/${flow.id}`, {
        projectId: cfg.projectId,
        status: 'ENABLED',
        version: updatedVersion,
      })

      activatedFlows.push(flow.displayName)
      await audit(dbh, organizationId, {
        actorName: 'reconciler',
        actorKind: 'system',
        action: 'integrations.flow_activated',
        targetType: 'flow',
        targetId: flow.id,
        detail: { flow: flow.displayName, piece: triggerPiece, connection: connection.id },
      })
    } catch (err) {
      console.warn(`[reconciler] activation "${flow.displayName}" échouée:`, String(err).slice(0, 150))
    }
  }

  return { connectedPieces, activatedFlows, alreadyActive }
}

/** Démarre le reconciler en polling périodique (toutes les 30 s). */
export function startReconciler(
  dbh: DbHandle,
  organizationId: string,
  cfg: ActivepiecesConfig,
  intervalMs = 30_000,
): () => void {
  const tick = async () => {
    try {
      const result = await reconcileConnections(dbh, organizationId, cfg)
      if (result.activatedFlows.length > 0) {
        console.log(`[reconciler] ${result.activatedFlows.length} flow(s) activé(s) automatiquement : ${result.activatedFlows.join(', ')}`)
      }
    } catch {
      // Activepieces indisponible — silencieux, on retentera au prochain tick.
    }
  }
  void tick()
  const id = setInterval(tick, intervalMs)
  return () => clearInterval(id)
}

// Re-export apRequest pour les autres modules.
export { apRequest }
