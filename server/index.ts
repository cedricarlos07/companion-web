import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createDb } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { buildApiRouter } from './routes.js'
import { seedDatabase } from './seed.js'
import { config } from './config.js'
import { ensureUploadsDir } from './services/ingestion.js'
import { checkAiHealth } from './ai-settings.js'
import { memorySearchEngine, reindexMemoriesFromDb } from './memory/index.js'
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

  const autoSeed = process.env.AUTO_SEED !== '0'
  if (autoSeed) {
    try {
      const result = await seedDatabase(dbh)
      if (result.seeded) console.log('[companion] seed terminé:', result)
      else console.log('[companion] seed déjà présent — ignoré')
    } catch (err) {
      console.error('[companion] seed a échoué:', err)
    }
  }

  // État IA : modèles épinglés, dégradation annoncée — jamais de swap silencieux.
  const orgRows = await dbh.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`)
  const primaryOrgId = orgRows[0]?.id
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

  // Serve the built frontend (self-hosted single binary mode).
  const distDir = path.join(__dirname, '..', 'dist')
  if (fs.existsSync(distDir)) {
    app.use(express.static(distDir))
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  app.listen(config.port, () => {
    console.log(`[companion] API prête sur http://localhost:${config.port} (driver: ${dbh.driver}, moteur mémoire: ${memorySearchEngine()})`)
  })
}

main().catch((err) => {
  console.error('[companion] démarrage impossible:', err)
  process.exit(1)
})
