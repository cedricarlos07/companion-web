import { Router, json as expressJson } from 'express'
import type { DbHandle } from './db.js'
import { PLANS } from './plans.js'

/**
 * API licences — le seul control plane de Companion.
 *
 * Companion n'envoie JAMAIS de données métier ici : uniquement licenseId,
 * instanceId, version, mode et des compteurs d'usage agrégés.
 */

interface LicenseRow {
  license_id: string
  customer_id: string
  plan: string
  status: string
  max_instances: number
  expires_at: string | null
  entitlements: Record<string, unknown>
}

async function findLicense(dbh: DbHandle, licenseId: string): Promise<LicenseRow | undefined> {
  return (
    await dbh.query<LicenseRow>(
      `SELECT license_id, customer_id, plan, status, max_instances, expires_at::text AS expires_at, entitlements
       FROM licenses WHERE license_id = '${licenseId.replace(/'/g, "''")}' LIMIT 1`,
    )
  )[0]
}

function licenseState(lic: LicenseRow | undefined): 'active' | 'expired' | 'revoked' | 'unknown' {
  if (!lic || lic.status === 'revoked') return 'unknown'
  if (lic.expires_at && new Date(lic.expires_at) < new Date()) return 'expired'
  return 'active'
}

export function buildLicenseApi(dbh: DbHandle): Router {
  const router = Router()
  router.use(expressJson())

  /** Activation d'une instance : lie instanceId ↔ licence (maxInstances). */
  router.post('/v1/activate', async (req, res) => {
    const { license, instanceId, version } = req.body as { license?: string; instanceId?: string; version?: string }
    if (!license || !instanceId) return res.status(400).json({ error: 'license et instanceId requis' })
    let licenseId = ''
    try {
      const parsed = JSON.parse(Buffer.from(license, 'base64').toString()) as { payload?: { licenseId?: string } }
      licenseId = parsed.payload?.licenseId ?? ''
    } catch {
      return res.status(400).json({ error: 'licence illisible' })
    }
    const lic = await findLicense(dbh, licenseId)
    const state = licenseState(lic)
    if (state === 'unknown' || state === 'revoked') return res.status(404).json({ error: 'licence inconnue ou révoquée' })

    const activations = await dbh.query<{ cnt: string }>(
      `SELECT count(*)::text AS cnt FROM license_activations WHERE license_id = '${licenseId.replace(/'/g, "''")}' AND status = 'active'`,
    )
    const already = await dbh.query<{ id: string }>(
      `SELECT id FROM license_activations WHERE instance_id = '${instanceId.replace(/'/g, "''")}' AND license_id = '${licenseId.replace(/'/g, "''")}' LIMIT 1`,
    )
    const activeCount = Number(activations[0]?.cnt ?? 0)
    const max = lic!.max_instances ?? 1
    if (!already[0] && activeCount >= max) {
      return res.status(409).json({
        error: `Limite d'instances atteinte (${activeCount}/${max}). Contactez Kamaloka pour réinitialiser une activation.`,
        activeInstances: activeCount,
        maxInstances: max,
      })
    }
    if (already[0]) {
      await dbh.exec(
        `UPDATE license_activations SET status = 'active', version = '${(version ?? '').replace(/'/g, "''")}',
         last_heartbeat_at = now() WHERE id = '${already[0].id}'`,
      )
    } else {
      await dbh.exec(
        `INSERT INTO license_activations (license_id, instance_id, status, version, last_heartbeat_at)
         VALUES ('${licenseId.replace(/'/g, "''")}', '${instanceId.replace(/'/g, "''")}', 'active', '${(version ?? '').replace(/'/g, "''")}', now())`,
      )
    }
    res.json({ status: state, plan: lic!.plan, expiresAt: lic!.expires_at, entitlements: lic!.entitlements })
  })

  /** Validation ponctuelle : la licence est-elle encore bonne ? */
  router.post('/v1/validate', async (req, res) => {
    const { licenseId, instanceId } = req.body as { licenseId?: string; instanceId?: string }
    if (!licenseId) return res.status(400).json({ error: 'licenseId requis' })
    const lic = await findLicense(dbh, licenseId)
    const state = licenseState(lic)
    if (state !== 'active') return res.json({ status: state })
    if (instanceId) {
      const act = await dbh.query<{ id: string }>(
        `SELECT id FROM license_activations WHERE license_id = '${licenseId.replace(/'/g, "''")}' AND instance_id = '${instanceId.replace(/'/g, "''")}' AND status = 'active' LIMIT 1`,
      )
      if (!act[0]) return res.status(403).json({ error: 'instance non activée pour cette licence', status: 'not_activated' })
    }
    res.json({ status: state, plan: lic!.plan, expiresAt: lic!.expires_at })
  })

  /** Désactivation (migration de serveur, réinitialisation d'activation). */
  router.post('/v1/deactivate', async (req, res) => {
    const { licenseId, instanceId } = req.body as { licenseId?: string; instanceId?: string }
    if (!licenseId || !instanceId) return res.status(400).json({ error: 'licenseId et instanceId requis' })
    await dbh.exec(
      `UPDATE license_activations SET status = 'deactivated'
       WHERE license_id = '${licenseId.replace(/'/g, "''")}' AND instance_id = '${instanceId.replace(/'/g, "''")}'`,
    )
    res.json({ ok: true })
  })

  /** Heartbeat quotidien (métadonnées opérationnelles uniquement). */
  router.post('/v1/heartbeat', async (req, res) => {
    const { licenseId, instanceId, version, mode, counts } = req.body as {
      licenseId?: string; instanceId?: string; version?: string; mode?: string; counts?: Record<string, number>
    }
    if (!licenseId || !instanceId) return res.status(400).json({ error: 'licenseId et instanceId requis' })
    const lic = await findLicense(dbh, licenseId)
    const state = licenseState(lic)
    if (state === 'unknown') return res.json({ status: 'unknown' })
    // Seules les instances activées peuvent envoyer un heartbeat.
    const act = await dbh.query<{ id: string }>(
      `SELECT id FROM license_activations WHERE license_id = '${licenseId.replace(/'/g, "''")}' AND instance_id = '${instanceId.replace(/'/g, "''")}' AND status = 'active' LIMIT 1`,
    )
    if (!act[0]) return res.status(404).json({ error: 'instance non activée pour cette licence' })
    await dbh.exec(
      `UPDATE license_activations SET last_heartbeat_at = now(),
        version = '${(version ?? '').replace(/'/g, "''")}',
        mode = '${(mode ?? 'active').replace(/'/g, "''")}',
        counts = '${JSON.stringify(counts ?? {}).replace(/'/g, "''")}'::jsonb
       WHERE id = '${act[0].id}'`,
    )
    res.json({ status: state, plan: lic?.plan ?? PLANS.pilot.label.toLowerCase(), expiresAt: lic?.expires_at ?? null })
  })

  return router
}
