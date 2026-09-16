import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createDb } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { buildApiRouter } from './routes.js'
import { seedDatabase } from './seed.js'
import { config } from './config.js'
import { ensureUploadsDir } from './services/ingestion.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const dbh = await createDb()
  await runMigrations(dbh)
  ensureUploadsDir()
  fs.mkdirSync('./data/tmp-uploads', { recursive: true })

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
    console.log(`[companion] API prête sur http://localhost:${config.port} (driver: ${dbh.driver})`)
  })
}

main().catch((err) => {
  console.error('[companion] démarrage impossible:', err)
  process.exit(1)
})
