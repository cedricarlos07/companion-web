import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createDb } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { buildApiRouter } from './routes.js'
import { seedDatabase } from './seed.js'
import { config } from './config.js'
import { APP_VERSION } from './version.js'
import { ensureUploadsDir } from './services/ingestion.js'
import { checkAiHealth } from './ai-settings.js'
import { memorySearchEngine, reindexMemoriesFromDb } from './memory/index.js'
import { buildAgentRouter, ensureAgentsSeeded } from './mastra/routes-agents.js'
import { mountMcpHttp } from './mcp/http.js'
import { buildMcpManagementRouter } from './mcp/routes-mcp.js'
import { securityHeaders } from './middleware/security.js'
import { buildActivepiecesRouter } from './activepieces/routes-ap.js'
import { buildIntegrationsRouter } from './integrations/catalog.js'
import { buildSetupRouter } from './setup.js'
import { isActivepiecesEnabled, initializeExternalTools } from './activepieces/provider.js'
import { bootstrapActivepieces } from './activepieces/bootstrap.js'
import { startReconciler } from './activepieces/reconciler.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const dbh = await createDb()
  await runMigrations(dbh)
  ensureUploadsDir()
  fs.mkdirSync('./data/tmp-uploads', { recursive: true })

  // Production : PostgreSQL réel obligatoire. PGlite = dev/test uniquement.
  if (process.env.NODE_ENV === 'production' && dbh.driver === 'pglite') {
    console.warn('[companion] ⚠️  NODE_ENV=production avec PGlite — PostgreSQL + pgvector requis en production (DATABASE_URL).')
  }

  const app = express()
  app.use(cors({ origin: config.frontendOrigin, credentials: true }))
  app.use(express.json({ limit: '25mb' }))
  app.use(cookieParser())
  app.use(securityHeaders)

  // Seed de démonstration OPT-IN : les instances clients démarrent VIERGES et
  // passent par l'assistant /setup. Mettre AUTO_SEED=1 pour une instance démo.
  const autoSeed = process.env.AUTO_SEED === '1'
  if (autoSeed) {
    try {
      const result = await seedDatabase(dbh)
      if (result.seeded) console.log('[companion] seed terminé:', result)
      else console.log('[companion] seed déjà présent — ignoré')
    } catch (err) {
      console.error('[companion] seed a échoué:', err)
    }
  }

  // Agents V1 (allowlists explicites, deny par défaut).
  const orgRows = await dbh.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`)
  const primaryOrgId = orgRows[0]?.id

  await ensureAgentsSeeded(dbh)

  // Activepieces auto-provisioning : crée les flows Companion dans Activepieces.
  if (isActivepiecesEnabled()) {
    const apUrl = process.env.ACTIVEPIECES_URL ?? 'http://localhost:5678'
    const apToken = process.env.ACTIVEPIECES_MCP_TOKEN
    const apProjectId = process.env.ACTIVEPIECES_PROJECT_ID
    if (apToken && apProjectId) {
      const { bootstrapActivepieces } = await import('./activepieces/bootstrap.js')
      void bootstrapActivepieces(dbh, primaryOrgId, apUrl, apToken, apProjectId)
        .then((r) => console.log(`[companion] Activepieces : ${r.created} flow(s) créés, ${r.existing} existants`))
        .catch((err) => console.warn('[companion] Activepieces bootstrap échoué:', String(err).slice(0, 150)))
      // Connection reconciler : détecte les connexions ACTIVE et active les flows.
      const { startReconciler } = await import('./activepieces/reconciler.js')
      startReconciler(dbh, primaryOrgId, { url: apUrl, token: apToken, projectId: apProjectId }, 30_000)
      console.log('[companion] Connection reconciler démarré (30s)')
    }
  }

  // État IA : modèles épinglés, dégradation annoncée — jamais de swap silencieux.
  if (primaryOrgId) {
    const health = await checkAiHealth(dbh, primaryOrgId)
    if (health.degraded) {
      console.warn('[companion] ⚠️  IA dégradée :', health.issues.join(' | '))
    } else {
      console.log(`[companion] IA OK — chat: ${health.chatModel}, embeddings: ${health.embedModel}`)
    }
    // Ré-indexation Mem0 (store memory éphémère) en arrière-plan.
    if (memorySearchEngine() !== 'native') {
      void reindexMemoriesFromDb(dbh, primaryOrgId)
        .then((n) => n > 0 && console.log(`[companion] Mem0 : ${n} mémoires ré-indexées`))
        .catch((err) => console.warn('[companion] reindex Mem0 échoué:', String(err).slice(0, 200)))
    }
  }

  app.use('/api', buildApiRouter(dbh))
  app.use('/api', buildAgentRouter(dbh))
  app.use('/api/mcp', buildMcpManagementRouter(dbh))
  app.use('/api/ap', buildActivepiecesRouter(dbh))
  app.use('/api/integrations', buildIntegrationsRouter(dbh))
  app.use('/api/setup', buildSetupRouter(dbh))
  mountMcpHttp(app, dbh)

  // Serve the built frontend (self-hosted single binary mode).
  const distDir = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  // Activepieces : découverte des tools externes en arrière-plan.
  if (isActivepiecesEnabled() && primaryOrgId) {
    void initializeExternalTools(dbh, primaryOrgId)
      .then((n) => n > 0 && console.log(`[companion] Activepieces : ${n} tools externes disponibles`))
      .catch((err) => console.warn('[companion] Activepieces init échoué:', String(err).slice(0, 150)))
  }

  app.listen(config.port, () => {
    console.log(`[companion] API prête sur http://localhost:${config.port} (driver: ${dbh.driver}, moteur mémoire: ${memorySearchEngine()})`)
    // Self-hosted Connected : heartbeat licence quotidien (métadonnées seulement, best-effort).
    void import('./services/license-mode.js').then(({ startLicenseHeartbeat }) => startLicenseHeartbeat(dbh, APP_VERSION))
  })
}

main().catch((err) => {
  console.error('[companion] démarrage impossible:', err)
  process.exit(1)
})
