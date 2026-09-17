import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { apRequest, type ActivepiecesConfig } from './bootstrap.js'

/**
 * Connection Reconciler — détecte automatiquement quand une connexion
 * Activepieces devient ACTIVE et active le flow correspondant.
 *
 * Le client clique "Connecter Google Drive" dans Companion → OAuth Google →
 * le reconciler détecte la connexion → active le flow → statut "Connecté".
 *
 * Le client ne voit JAMAIS Activepieces.
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
      settings?: { pieceName?: string }
    }
  }
}

export interface ReconcileResult {
  connected: string[]
  activated: string[]
  alreadyActive: string[]
}

export async function reconcileConnections(
  dbh: DbHandle,
  organizationId: string,
  cfg: ActivepiecesConfig,
): Promise<ReconcileResult> {
  const [connections, flows] = await Promise.all([
    apRequest<{ data: ApConnection[] }>(cfg, 'GET', `/app-connections?projectId=${cfg.projectId}&limit=100`),
    apRequest<{ data: ApFlow[] }>(cfg, 'GET', `/flows?projectId=${cfg.projectId}&limit=100`),
  ])

  const activeConnections = (connections.data ?? []).filter((c) => c.status === 'ACTIVE')
  const connectedPieces = new Set(activeConnections.map((c) => c.pieceName))

  const activated: string[] = []
  const alreadyActive: string[] = []
  const connected: string[] = [...connectedPieces]

  for (const flow of flows.data ?? []) {
    const triggerPiece = flow.version?.trigger?.settings?.pieceName
    if (!triggerPiece || !connectedPieces.has(triggerPiece)) continue

    if (flow.status === 'DISABLED') {
      try {
        await apRequest(cfg, 'POST', `/flows/${flow.id}`, {
          projectId: cfg.projectId,
          status: 'ENABLED',
        })
        activated.push(flow.displayName)
        await audit(dbh, organizationId, {
          actorName: 'reconciler', actorKind: 'system',
          action: 'integrations.flow_activated',
          targetType: 'flow', targetId: flow.id,
          detail: { flow: flow.displayName, piece: triggerPiece },
        })
      } catch (err) {
        console.warn(`[reconciler] activation "${flow.displayName}" échouée:`, String(err).slice(0, 150))
      }
    } else {
      alreadyActive.push(flow.displayName)
    }
  }

  return { connected, activated, alreadyActive }
}

/** Démarre le reconciler en polling périodique. */
export function startReconciler(
  dbh: DbHandle,
  organizationId: string,
  cfg: ActivepiecesConfig,
  intervalMs = 30_000,
): () => void {
  const tick = async () => {
    try {
      const result = await reconcileConnections(dbh, organizationId, cfg)
      if (result.activated.length > 0) {
        console.log(`[reconciler] ${result.activated.length} flow(s) activé(s) : ${result.activated.join(', ')}`)
      }
    } catch {
      // Activepieces indisponible — silencieux, on retentera.
    }
  }
  void tick()
  const id = setInterval(tick, intervalMs)
  return () => clearInterval(id)
}
