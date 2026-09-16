import { Router } from 'express'
import type { DbHandle } from '../db/client.js'
import { authRequired, requireRole } from '../auth.js'
import { audit } from '../audit.js'
import { dispatchEvent } from '../mastra/triggers.js'
import { isActivepiecesEnabled, initializeExternalTools, getExternalTools, externalHealth } from '../activepieces/provider.js'
import { ingestDocument } from '../services/ingestion.js'

/**
 * Webhooks Activepieces + endpoint de santé + déclencheur d'ingestion.
 * Activepieces pousse les fichiers Drive/Gmail vers Companion ; Companion
 * exécute son pipeline d'ingestion existant (extract → chunk → embed → candidates).
 */
export function buildActivepiecesRouter(dbh: DbHandle): Router {
  const router = Router()

  /** Activepieces health — public (lecture seule). */
  router.get('/ap/health', async (_req, res) => {
    const health = await externalHealth()
    res.json(health)
  })

  /** Webhook : Activepieces pousse un fichier Drive (base64 ou URL) → ingestion. */
  router.post('/webhooks/activepieces/file', async (req, res) => {
    if (!isActivepiecesEnabled()) {
      return res.status(403).json({ error: 'Activepieces non configuré' })
    }
    const { fileName, content, mimeType, sourceName, employeeId } = req.body as {
      fileName?: string; content?: string; mimeType?: string; sourceName?: string; employeeId?: string
    }
    if (!fileName || !content) {
      return res.status(400).json({ error: 'fileName et content requis' })
    }
    const orgRows = await dbh.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`)
    const orgId = orgRows[0]?.id
    if (!orgId) return res.status(500).json({ error: 'organisation introuvable' })

    // Crée la source et le document, puis exécute le pipeline d'ingestion.
    await dbh.exec(
      `INSERT INTO sources (organization_id, kind, name, status, config)
       VALUES ('${orgId}', 'local', '${(sourceName ?? 'Activepieces').replace(/'/g, "''")}', 'connected',
               '${JSON.stringify({ employeeId: employeeId ?? null, viaActivepieces: true }).replace(/'/g, "''")}'::jsonb)`,
    )
    const srcRows = await dbh.query<{ id: string }>(`SELECT id FROM sources ORDER BY created_at DESC LIMIT 1`)
    const sourceId = srcRows[0]?.id

    const { storagePathFor } = await import('../services/ingestion.js')
    const filePath = storagePathFor(orgId, fileName)
    const fs = await import('node:fs')
    fs.writeFileSync(filePath, content, 'utf8')

    const ext = (fileName.slice(fileName.lastIndexOf('.')) || '.txt').toLowerCase()
    const mime = ext.replace('.', '')
    const docRows = await dbh.query<{ id: string }>(
      `INSERT INTO documents (organization_id, source_id, title, mime_type, size_bytes, storage_path, status)
       VALUES ('${orgId}', '${sourceId}', '${fileName.replace(/'/g, "''")}', '${mime}', ${Buffer.byteLength(content)}, '${filePath.replace(/\\/g, '\\\\')}', 'queued')
       RETURNING id`,
    )
    const doc = docRows[0]

    await audit(dbh, orgId, {
      actorName: 'activepieces', actorKind: 'system',
      action: 'source.uploaded', targetType: 'document', targetId: doc.id,
      detail: { fileName, via: 'activepieces-webhook' },
    })

    // Ingestion asynchrone — le webhook répond immédiatement.
    void ingestDocument(dbh, doc.id, 'Activepieces').catch((err) => {
      console.error('[activepieces] ingestion échouée:', String(err).slice(0, 200))
    })

    res.json({ documentId: doc.id, status: 'ingestion lancée' })
  })

  /** Endpoint pour déclencher l'ingestion manuellement (admin). */
  router.post('/ap/ingest/:documentId', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { ingestDocument } = await import('../services/ingestion.js')
    try {
      const result = await ingestDocument(dbh, req.params.documentId as string, req.user!.name)
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: String(err).slice(0, 300) })
    }
  })

  /** Liste les tools externes Activepieces disponibles. */
  router.get('/ap/tools', authRequired(dbh), async (_req, res) => {
    const tools = getExternalTools()
    res.json({ tools: tools.map((t) => ({ name: t.name, description: t.description, riskLevel: t.riskLevel })), count: tools.length })
  })

  return router
}

export { dispatchEvent, isActivepiecesEnabled }
