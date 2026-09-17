import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import type { DbHandle } from '../db/client.js'
import { verifyLicense, type LicensePayload } from './licenses.js'

/**
 * Modes de licence côté client (self-hosted).
 *
 *  active     — licence valide ou essai : tout fonctionne.
 *  grace      — licence expirée, période de grâce (30 j) : tout fonctionne + bannière.
 *  restricted — grâce dépassée : consultation, export et backup restent libres ;
 *               création (utilisateurs, agents, intégrations, actions agentiques) bloquée.
 *
 * Jamais de kill-switch : les données du client restent accessibles et exportables.
 * Le levier commercial est la reprise des créations, pas l'otage des données.
 */

export type LicenseMode = 'active' | 'grace' | 'restricted'

const GRACE_DAYS = Math.max(0, Number(process.env.LICENSE_GRACE_DAYS ?? 30))

export interface LicenseModeInfo {
  mode: LicenseMode
  status: 'active' | 'expired' | 'invalid' | 'not_configured'
  plan: string
  licenseId: string | null
  expiresAt: string | null
  graceUntil: string | null
  daysLeft: number | null
  message: string
}

/* ----------------------------- instanceId -------------------------------- */

/** Identifiant d'instance stable (cmp_inst_…), persisté dans settings. */
export async function getInstanceId(dbh: DbHandle, organizationId: string): Promise<string> {
  const rows = await dbh
    .query<{ value: unknown }>(`SELECT value FROM settings WHERE organization_id = '${organizationId}' AND key = 'instance'`)
    .catch(() => [])
  const existing = rows[0]?.value as { instanceId?: string } | undefined
  if (existing?.instanceId) return existing.instanceId
  const instanceId = `cmp_inst_${crypto.randomBytes(8).toString('hex')}`
  await dbh
    .exec(
      `INSERT INTO settings (organization_id, key, value) VALUES ('${organizationId}', 'instance', '${JSON.stringify({ instanceId, createdAt: new Date().toISOString() })}'::jsonb)
       ON CONFLICT (organization_id, key) DO UPDATE SET value = '${JSON.stringify({ instanceId, createdAt: new Date().toISOString() })}'::jsonb, updated_at = now()`,
    )
    .catch(() => {})
  return instanceId
}

/* ------------------------------- mode ------------------------------------ */

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000)
}

export async function getLicenseMode(dbh: DbHandle, organizationId: string): Promise<LicenseModeInfo> {
  const rows = await dbh
    .query<{ signature: string; status: string; grace_until: string | null }>(
      `SELECT signature, status, grace_until FROM licenses
       WHERE organization_id = '${organizationId}' AND status NOT IN ('revoked', 'replaced')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .catch(() => [])

  const row = rows[0]
  if (!row) {
    return {
      mode: 'active', status: 'not_configured', plan: 'pilot', licenseId: null, expiresAt: null, graceUntil: null,
      daysLeft: null, message: 'Essai — aucune licence installée.',
    }
  }

  const verification = verifyLicense(row.signature)

  // Clé publique absente (dev) : impossible de vérifier — on reste opérationnel.
  if (verification.status === 'not_configured') {
    return {
      mode: 'active', status: 'not_configured', plan: 'pilot', licenseId: null, expiresAt: null, graceUntil: null,
      daysLeft: null, message: 'Vérification de licence inactive (LICENSE_PUBLIC_KEY absente).',
    }
  }

  const payload: LicensePayload | undefined = verification.payload
  if (verification.valid && payload) {
    const expiresAt = payload.expiresAt
    const daysLeft = expiresAt ? daysBetween(new Date(), new Date(expiresAt)) : null
    return {
      mode: 'active', status: 'active', plan: payload.plan, licenseId: payload.licenseId, expiresAt,
      graceUntil: row.grace_until, daysLeft,
      message: daysLeft !== null && daysLeft <= 30
        ? `Licence active — expire dans ${daysLeft} jour(s).`
        : 'Licence active.',
    }
  }

  if (verification.status === 'expired' && payload) {
    const graceUntil = row.grace_until ?? (payload.expiresAt ? addDays(payload.expiresAt, GRACE_DAYS) : null)
    const daysLeft = graceUntil ? daysBetween(new Date(), new Date(graceUntil)) : 0
    if (graceUntil && new Date(graceUntil) > new Date()) {
      return {
        mode: 'grace', status: 'expired', plan: payload.plan, licenseId: payload.licenseId, expiresAt: payload.expiresAt,
        graceUntil, daysLeft,
        message: `Licence expirée — période de grâce : ${daysLeft} jour(s) restant(s). Contactez Kamaloka pour renouveler.`,
      }
    }
    return {
      mode: 'restricted', status: 'expired', plan: payload.plan, licenseId: payload.licenseId, expiresAt: payload.expiresAt,
      graceUntil, daysLeft: 0,
      message: 'Licence expirée — mode restreint : consultation, export et backup disponibles. Contactez Kamaloka pour renouveler.',
    }
  }

  // Signature invalide = licence falsifiée : restriction immédiate, pas de grâce.
  return {
    mode: 'restricted', status: 'invalid', plan: 'pilot', licenseId: payload?.licenseId ?? null, expiresAt: null,
    graceUntil: null, daysLeft: 0,
    message: 'Licence invalide — mode restreint. Contactez Kamaloka.',
  }
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

/* ------------------------------ garde ------------------------------------ */

/** Middleware : bloque les créations en mode restreint (402), laisse lecture/export/backup. */
export function licenseGate(dbh: DbHandle) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const orgId = res.locals?.user?.organizationId ?? (await firstOrganizationId(dbh))
      if (!orgId) return next()
      const info = await getLicenseMode(dbh, orgId)
      if (info.mode === 'restricted') {
        return res.status(402).json({
          error: 'Licence expirée — mode restreint. La consultation, l\'export et les backups restent disponibles. Contactez Kamaloka pour renouveler.',
          mode: info.mode,
          licenseId: info.licenseId,
        })
      }
      next()
    } catch {
      // En cas d'erreur interne de vérification, on ne bloque jamais l'usage.
      next()
    }
  }
}

export async function firstOrganizationId(dbh: DbHandle): Promise<string | null> {
  const rows = await dbh
    .query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`)
    .catch(() => [])
  return rows[0]?.id ?? null
}

/* ---------------------------- heartbeat ---------------------------------- */

const HEARTBEAT_URL = process.env.LICENSE_SERVER_URL ?? ''
const HEARTBEAT_INTERVAL_MS = 24 * 60 * 60 * 1000

/**
 * Self-hosted Connected : un appel quotidien vers le control plane Kamaloka.
 * N'envoie QUE des métadonnées opérationnelles — jamais de mémoires, documents,
 * emails ou conversations. Best-effort : un échec n'a aucun impact produit.
 */
export function startLicenseHeartbeat(dbh: DbHandle, version: string): void {
  if (!HEARTBEAT_URL) return
  const beat = async () => {
    try {
      const orgId = await firstOrganizationId(dbh)
      if (!orgId) return
      const info = await getLicenseMode(dbh, orgId)
      if (!info.licenseId) return
      const instanceId = await getInstanceId(dbh, orgId)
      const rows = await dbh
        .query<{ signature: string }>(
          `SELECT signature FROM licenses WHERE organization_id = '${orgId}' AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        )
        .catch(() => [])
      const licenseFile = rows[0]?.signature
      if (!licenseFile) return
      const counts = await dbh
        .query<{ users: string; agents: string; integrations: string }>(
          `SELECT
            (SELECT count(*) FROM users WHERE organization_id = '${orgId}')::text AS users,
            (SELECT count(*) FROM agents WHERE organization_id = '${orgId}' AND status != 'paused')::text AS agents,
            (SELECT count(*) FROM sources WHERE organization_id = '${orgId}' AND status = 'connected')::text AS integrations`,
        )
        .catch(() => [])
      const base = {
        licenseId: info.licenseId,
        instanceId,
        version,
        mode: info.mode,
        counts: {
          users: Number(counts[0]?.users ?? 0),
          agents: Number(counts[0]?.agents ?? 0),
          integrations: Number(counts[0]?.integrations ?? 0),
        },
      }
      const post = (path: string, body: unknown) =>
        fetch(`${HEARTBEAT_URL.replace(/\/$/, '')}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        })
      let res = await post('/v1/heartbeat', base)
      // Instance inconnue du control plane (installation offline importée entre-temps) :
      // activation automatique — le serveur applique maxInstances.
      if (res.status === 404 || res.status === 403) {
        await post('/v1/activate', { license: licenseFile, instanceId, version })
        res = await post('/v1/heartbeat', base)
      }
      if (res.ok) console.log('[companion] heartbeat licence envoyé')
      else console.warn(`[companion] heartbeat licence: réponse ${res.status}`)
    } catch (err) {
      console.warn(`[companion] heartbeat licence ignoré: ${String(err).slice(0, 120)}`)
    }
  }
  setTimeout(beat, 30_000)
  setInterval(beat, HEARTBEAT_INTERVAL_MS)
}
