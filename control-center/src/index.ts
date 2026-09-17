import express from 'express'
import { getDb } from './db.js'
import { buildLicenseApi } from './license-api.js'
import { buildAdminApi } from './admin.js'
import { buildUi } from './ui.js'

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
  // API admin (x-admin-key).
  app.use('/admin', buildAdminApi(dbh))
  // UI interne (cookie cc_admin).
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
