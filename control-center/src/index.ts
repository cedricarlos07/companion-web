import express from 'express'
import path from 'node:path'
import { getDb } from './db.js'
import { buildLicenseApi } from './license-api.js'
import { buildAdminApi, adminAuthorized } from './admin.js'
import { buildUi } from './ui.js'
import { buildPortal } from './portal.js'
import { buildLeadsApi } from './leads.js'
import fs from 'node:fs'

/**
 * KAMALOKA CONTROL CENTER — le côté éditeur.
 * Clients, licences signées (.lic), activations, factures, paiements.
 *
 * Séparation fondamentale :
 *   - le client héberge ses données (Companion self-hosted) ;
 *   - Kamaloka contrôle le DROIT d'utiliser Companion (licences).
 *
 * Port par défaut : 5300. En production : license.kamaloka.ai (reverse proxy).
 */

const PORT = Number(process.env.CC_PORT ?? 5300)

async function main() {
  const dbh = await getDb()
  const app = express()
  app.disable('x-powered-by')

  app.get('/health', (_req, res) => {
    res.json({ status: 'active', service: 'kamaloka-control-center', version: '0.1.0' })
  })

  // Le control plane des licences (Companion → Kamaloka).
  app.use(buildLicenseApi(dbh))
  // Demandes de démo (landing → leads commerciaux).
  app.use(buildLeadsApi(dbh))

  // Dernière release publique — interrogé par les instances Companion.
  app.get('/releases/latest', async (_req, res) => {
    const latest = (
      await dbh.query<{ version: string; channel: string; minimum_version: string }>(
        `SELECT version, channel, minimum_version FROM releases WHERE channel = 'stable' ORDER BY published_at DESC LIMIT 1`,
      )
    )[0]
    if (!latest) return res.status(404).json({ error: 'aucune release publiée' })
    res.json({ version: latest.version, channel: latest.channel, minimumVersion: latest.minimum_version })
  })

  // API admin (x-admin-key).
  app.use('/admin', buildAdminApi(dbh))
  // Portail client (session cookie).
  app.use(buildPortal(dbh))
  // Landing + docs (build React design-system : npm run build:marketing → website/dist)
  // montés AVANT l'UI admin interne. En production : sous-domaines dédiés (nginx).
  const mkt = path.resolve('../website/dist')
  if (fs.existsSync(mkt)) {
    app.get('/landing', (_req, res) => res.sendFile(path.join(mkt, 'landing.html')))
    app.get('/docs', (_req, res) => res.sendFile(path.join(mkt, 'docs.html')))
    app.get('/demo', (_req, res) => res.sendFile(path.join(mkt, 'demo.html')))
    app.use('/assets', express.static(path.join(mkt, 'assets')))
  }
  // UI interne (cookie cc_admin) en dernier.
  app.use(buildUi(dbh))

  app.listen(PORT, () => {
    console.log(`[cc] Control Center prêt sur http://localhost:${PORT}`)
    console.log('[cc] API licences : POST /v1/activate | /v1/validate | /v1/deactivate | /v1/heartbeat')
  })
}

main().catch((err) => {
  console.error('[cc] démarrage impossible:', err)
  process.exit(1)
})
