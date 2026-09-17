import type { DbHandle } from '../db/client.js'

/**
 * Auto-provisioning Activepieces.
 *
 * Au premier démarrage de Companion avec Activepieces activé :
 *   1. Crée les flow templates Companion (Drive → ingestion, Gmail → envoi)
 *   2. Configure les variables projet
 *   3. Les flows restent DISABLED tant que l'utilisateur n'a pas connecté
 *      l'application correspondante (OAuth) depuis la page Intégrations.
 *
 * Le client ne voit jamais Activepieces. Il voit "Connecter Google Drive"
 * dans Companion, et Companion gère le reste.
 */

interface ActivepiecesConfig {
  url: string
  token: string
  projectId: string
}

async function apRequest<T>(
  cfg: ActivepiecesConfig,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${cfg.url}/api/v1${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`Activepieces API ${res.status}: ${path}`)
  return (await res.json()) as T
}

/** Flow templates pré-packagés par Companion. */
const FLOW_TEMPLATES = [
  {
    displayName: 'Companion Drive Ingestion',
    pieceName: 'google-drive',
    triggerName: 'new_file_in_folder',
    description: 'Nouveau fichier Drive → ingestion dans le Company Brain',
  },
  {
    displayName: 'Companion Gmail Ingestion',
    pieceName: 'gmail',
    triggerName: 'new_email_received',
    description: 'Nouvel email → extraction des connaissances',
  },
  {
    displayName: 'Companion Gmail Send',
    pieceName: 'gmail',
    triggerName: null, // Action pure (pas un trigger) — déclenché par les workflows
    description: 'Envoi d\'email après approbation',
  },
]

/**
 * Provisionne les flows Companion dans Activepieces.
 * Idempotent : ne crée que les flows manquants.
 */
export async function bootstrapActivepieces(
  dbh: DbHandle,
  organizationId: string,
  apUrl: string,
  apToken: string,
  apProjectId: string,
): Promise<{ created: number; existing: number }> {
  const cfg: ActivepiecesConfig = { url: apUrl, token: apToken, projectId: apProjectId }

  // Liste les flows existants pour éviter les doublons
  const existing = await apRequest<{ data: { displayName: string }[] }>(
    cfg, 'GET', `/flows?projectId=${apProjectId}`,
  ).catch(() => ({ data: [] }))
  const existingNames = new Set((existing.data ?? []).map((f) => f.displayName))

  let created = 0
  let existingCount = 0

  for (const template of FLOW_TEMPLATES) {
    if (existingNames.has(template.displayName)) {
      existingCount++
      continue
    }
    try {
      const trigger: Record<string, unknown> = template.triggerName
        ? {
            type: 'PIECE_TRIGGER',
            name: 'trigger',
            settings: {
              pieceName: template.pieceName,
              triggerName: template.triggerName,
              input: {},
            },
          }
        : {
            type: 'EMPTY',
            name: 'manual',
            settings: {},
          }

      await apRequest(cfg, 'POST', '/flows', {
        projectId: apProjectId,
        displayName: template.displayName,
        template: {
          valid: true,
          schemaVersion: 1,
          trigger,
          steps: {},
        },
      })
      created++
    } catch (err) {
      console.warn(`[ap-bootstrap] flow "${template.displayName}" création échouée:`, String(err).slice(0, 150))
    }
  }

  await import('../audit.js').then((m) =>
    m.audit(dbh, organizationId, {
      actorName: 'activepieces-bootstrap',
      actorKind: 'system',
      action: 'integrations.provisioned',
      targetType: 'activepieces',
      detail: { created, existing: existingCount, total: FLOW_TEMPLATES.length },
    }),
  )

  return { created, existing: existingCount }
}

/** Liste les connections Activepieces disponibles pour ce projet. */
export async function listConnections(cfg: ActivepiecesConfig): Promise<{ name: string; pieceName: string; status: string }[]> {
  const res = await apRequest<{ data: { displayName: string; pieceName: string; status: string }[] }>(
    cfg, 'GET', `/app-connections?projectId=${cfg.projectId}`,
  ).catch(() => ({ data: [] }))
  return (res.data ?? []).map((c) => ({
    name: c.displayName,
    pieceName: c.pieceName,
    status: c.status,
  }))
}

export { apRequest }
export type { ActivepiecesConfig }
