import crypto from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import type { DbHandle } from '../db/client.js'
import { verifyLicense, verifyLease, type LicensePayload, type LeasePayload } from './licenses.js'

/**
 * Modes de licence côté client (self-hosted).
 *
 *  active     — licence valide ou essai : tout fonctionne.
 *  grace      — licence ou lease expiré, période de grâce (14 j) :
 *               tout fonctionne + bannière.
 *  restricted — grâce dépassée : consultation, export et backup restent libres ;
 *               création (utilisateurs, agents, intégrations, MCP, actions
 *               agentiques) bloquée.
 *
 * Deux régimes :
 *  - OFFLINE  (LICENSE_SERVER_URL absent) — Enterprise / environnements isolés.
 *    La licence signée longue durée fait foi, vérifiée localement, aucun appel.
 *  - CONNECTED (LICENSE_SERVER_URL présent) — offre standard. Un heartbeat
 *    périodique (6–24 h) renouvelle un LEASE signé Ed25519 lié à l'instance.
 *    La révocation côté Kamaloka s'applique donc au pire à l'expiration du
 *    lease en cours : jour 1–7 valide, jour 8+ grâce, puis restricted.
 *
 * Jamais de kill-switch : les données du client restent accessibles et
 * exportables. Le levier commercial est la reprise des créations, pas
 * l'otage des données.
 */

export type LicenseMode = 'active' | 'grace' | 'restricted'

const GRACE_DAYS = Math.max(0, Number(process.env.LICENSE_GRACE_DAYS ?? 14))
/** Fenêtre attendue entre deux leases — sert au bootstrap et aux messages. */
const LEASE_DAYS = Math.max(1, Number(process.env.LICENSE_LEASE_DAYS ?? 7))

export interface LicenseModeInfo {
  mode: LicenseMode
  status: 'active' | 'expired' | 'invalid' | 'not_configured'
  plan: string
  licenseId: string | null
  expiresAt: string | null
  graceUntil: string | null
  daysLeft: number | null
  message: string
  /** connected = heartbeat vers license.kamaloka.ai ; offline = Enterprise isolé. */
  licensing: 'connected' | 'offline'
  /** Dernier lease signé lié à cette instance (connected uniquement). */
  lease: { status: 'ACTIVE' | 'GRACE'; validUntil: string; daysLeft: number | null } | null
  lastHeartbeatAt: string | null
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

/* ------------------------------ lease store ------------------------------- */

interface StoredLease {
  encoded: string
  receivedAt: string
  serverStatus: string | null
}

async function readStoredLease(dbh: DbHandle, organizationId: string): Promise<StoredLease | null> {
  const rows = await dbh
    .query<{ value: unknown }>(`SELECT value FROM settings WHERE organization_id = '${organizationId}' AND key = 'license-lease'`)
    .catch(() => [])
  return (rows[0]?.value as StoredLease | undefined) ?? null
}

async function writeStoredLease(dbh: DbHandle, organizationId: string, lease: StoredLease): Promise<void> {
  const json = JSON.stringify(lease).replace(/'/g, "''")
  await dbh
    .exec(
      `INSERT INTO settings (organization_id, key, value) VALUES ('${organizationId}', 'license-lease', '${json}'::jsonb)
       ON CONFLICT (organization_id, key) DO UPDATE SET value = '${json}'::jsonb, updated_at = now()`,
    )
    .catch(() => {})
}

/**
 * Reçoit la réponse du Control Center ({status, lease}) et persiste le lease
 * après vérification locale : signature Kamaloka + bind instanceId (un lease
 * copié vers une autre instance est ignoré). Sans lease dans la réponse
 * (suspension/révocation), le dernier lease signé continue de courir jusqu'à
 * son validUntil — jamais de kill brutal.
 */
export async function storeLeaseFromResponse(
  dbh: DbHandle,
  organizationId: string,
  body: { status?: string; lease?: string },
): Promise<{ stored: boolean; reason?: string }> {
  const receivedAt = new Date().toISOString()
  const previous = await readStoredLease(dbh, organizationId)
  const serverStatus = typeof body?.status === 'string' ? body.status.slice(0, 32) : null

  if (!body?.lease || typeof body.lease !== 'string') {
    await writeStoredLease(dbh, organizationId, {
      encoded: previous?.encoded ?? '',
      receivedAt,
      serverStatus,
    })
    return { stored: false, reason: 'aucun lease dans la réponse' }
  }

  const verification = verifyLease(body.lease)
  const usable = verification.valid || (verification.status === 'expired' && verification.payload)
  if (!usable || !verification.payload) {
    // Signature invalide ou payload non-lease : rejeté. Un lease signé mais
    // déjà expiré est stocké — la résolution de mode le dégrade (grâce →
    // restricted) et les tests peuvent simuler un vieux lease.
    return { stored: false, reason: verification.error ?? 'lease invalide' }
  }
  const instanceId = await getInstanceId(dbh, organizationId)
  if (verification.payload.instanceId !== instanceId) {
    return { stored: false, reason: 'lease lié à une autre instance' }
  }

  await writeStoredLease(dbh, organizationId, { encoded: body.lease, receivedAt, serverStatus })
  return { stored: true }
}

/* ------------------------------- mode ------------------------------------ */

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / 86_400_000)
}

function addDays(iso: string, days: number): string {
  return new Date(new Date(iso).getTime() + days * 86_400_000).toISOString()
}

export async function getLicenseMode(dbh: DbHandle, organizationId: string): Promise<LicenseModeInfo> {
  const CONNECTED = Boolean(process.env.LICENSE_SERVER_URL)

  const base = (over: Partial<LicenseModeInfo>): LicenseModeInfo => ({
    mode: 'active', status: 'active', plan: 'pilot', licenseId: null, expiresAt: null,
    graceUntil: null, daysLeft: null, message: '',
    licensing: CONNECTED ? 'connected' : 'offline', lease: null, lastHeartbeatAt: null,
    ...over,
  })

  const rows = await dbh
    .query<{ signature: string; status: string; grace_until: string | null }>(
      `SELECT signature, status, grace_until FROM licenses
       WHERE organization_id = '${organizationId}' AND status NOT IN ('revoked', 'replaced')
       ORDER BY created_at DESC LIMIT 1`,
    )
    .catch(() => [])

  const row = rows[0]
  if (!row) {
    return base({ status: 'not_configured', message: 'Essai — aucune licence installée.' })
  }

  const verification = verifyLicense(row.signature)

  // Clé publique absente (dev) : impossible de vérifier — on reste opérationnel.
  if (verification.status === 'not_configured') {
    return base({ status: 'not_configured', message: 'Vérification de licence inactive (LICENSE_PUBLIC_KEY absente).' })
  }

  const payload: LicensePayload | undefined = verification.payload
  if (!(verification.valid && payload)) {
    if (verification.status === 'expired' && payload) {
      const graceUntil = row.grace_until ?? (payload.expiresAt ? addDays(payload.expiresAt, GRACE_DAYS) : null)
      const daysLeft = graceUntil ? daysBetween(new Date(), new Date(graceUntil)) : 0
      if (graceUntil && new Date(graceUntil) > new Date()) {
        return base({
          mode: 'grace', status: 'expired', plan: payload.plan, licenseId: payload.licenseId, expiresAt: payload.expiresAt,
          graceUntil, daysLeft,
          message: `Licence expirée — période de grâce : ${daysLeft} jour(s) restant(s). Contactez Kamaloka pour renouveler.`,
        })
      }
      return base({
        mode: 'restricted', status: 'expired', plan: payload.plan, licenseId: payload.licenseId, expiresAt: payload.expiresAt,
        graceUntil, daysLeft: 0,
        message: 'Licence expirée — mode restreint : consultation, export et backup disponibles. Contactez Kamaloka pour renouveler.',
      })
    }

    // Signature invalide = licence falsifiée : restriction immédiate, pas de grâce.
    return base({
      mode: 'restricted', status: 'invalid', plan: 'pilot', licenseId: payload?.licenseId ?? null,
      message: 'Licence invalide — mode restreint. Contactez Kamaloka.',
    })
  }

  /* Licence signée valide — le régime décide de la suite. */
  const expiresAt = payload.expiresAt
  const licenseDaysLeft = expiresAt ? daysBetween(new Date(), new Date(expiresAt)) : null

  /* OFFLINE (Enterprise) : la licence longue durée fait foi, point. */
  if (!CONNECTED) {
    return base({
      plan: payload.plan, licenseId: payload.licenseId, expiresAt, daysLeft: licenseDaysLeft,
      message: licenseDaysLeft !== null && licenseDaysLeft <= 30
        ? `Licence active — expire dans ${licenseDaysLeft} jour(s).`
        : 'Licence active.',
    })
  }

  /* CONNECTED : le lease signé lié à l'instance gouverne. */
  const instanceId = await getInstanceId(dbh, organizationId)
  const stored = await readStoredLease(dbh, organizationId)
  const leaseVerification = stored?.encoded ? verifyLease(stored.encoded) : null
  const leasePayload: LeasePayload | undefined = leaseVerification?.payload
  const leaseBound =
    leasePayload &&
    leasePayload.licenseId === payload.licenseId &&
    leasePayload.instanceId === instanceId

  if (leaseVerification?.valid && leaseBound && leasePayload) {
    const leaseDaysLeft = daysBetween(new Date(), new Date(leasePayload.validUntil))
    if (leasePayload.status === 'GRACE') {
      return base({
        mode: 'grace', plan: payload.plan, licenseId: payload.licenseId, expiresAt,
        graceUntil: leasePayload.validUntil, daysLeft: leaseDaysLeft,
        lease: { status: leasePayload.status, validUntil: leasePayload.validUntil, daysLeft: leaseDaysLeft },
        lastHeartbeatAt: stored?.receivedAt ?? null,
        message: `Renouvellement en attente côté Kamaloka — lease valide encore ${leaseDaysLeft} jour(s).`,
      })
    }
    return base({
      plan: payload.plan, licenseId: payload.licenseId, expiresAt, daysLeft: licenseDaysLeft,
      lease: { status: leasePayload.status, validUntil: leasePayload.validUntil, daysLeft: leaseDaysLeft },
      lastHeartbeatAt: stored?.receivedAt ?? null,
      message: licenseDaysLeft !== null && licenseDaysLeft <= 30
        ? `Licence active — expire dans ${licenseDaysLeft} jour(s).`
        : 'Licence active.',
    })
  }

  // Lease expiré (et lié) : grâce depuis validUntil, puis restricted.
  if (leaseVerification?.status === 'expired' && leaseBound && leasePayload) {
    const graceUntil = addDays(leasePayload.validUntil, GRACE_DAYS)
    const daysLeft = daysBetween(new Date(), new Date(graceUntil))
    if (daysLeft > 0) {
      return base({
        mode: 'grace', plan: payload.plan, licenseId: payload.licenseId, expiresAt,
        graceUntil, daysLeft,
        lease: { status: leasePayload.status, validUntil: leasePayload.validUntil, daysLeft: null },
        lastHeartbeatAt: stored?.receivedAt ?? null,
        message: `Dernier lease expiré — grâce : ${daysLeft} jour(s) restant(s). Restaurez la connexion ou contactez Kamaloka.`,
      })
    }
    return base({
      mode: 'restricted', status: 'expired', plan: payload.plan, licenseId: payload.licenseId, expiresAt,
      graceUntil, daysLeft: 0,
      lease: { status: leasePayload.status, validUntil: leasePayload.validUntil, daysLeft: null },
      lastHeartbeatAt: stored?.receivedAt ?? null,
      message: 'Aucun renouvellement de lease — mode restreint : consultation, export et backup disponibles. Contactez Kamaloka.',
    })
  }

  // Pas (encore) de lease lié : fenêtre de bootstrap depuis l'émission de la
  // licence — le temps du premier heartbeat. Passée cette fenêtre : grâce,
  // puis restricted (une instance « connectée » qui ne contacte jamais
  // Kamaloka ne peut pas contourner la révocation).
  const bootstrapUntil = addDays(payload.issuedAt, LEASE_DAYS + GRACE_DAYS)
  const bootstrapLeft = daysBetween(new Date(), new Date(bootstrapUntil))
  if (bootstrapLeft > 0) {
    return base({
      plan: payload.plan, licenseId: payload.licenseId, expiresAt, daysLeft: licenseDaysLeft,
      lastHeartbeatAt: stored?.receivedAt ?? null,
      message: stored
        ? 'Licence active — en attente du prochain renouvellement de lease.'
        : `Licence active — premier contact avec license.kamaloka.ai attendu (${bootstrapLeft} jour(s) de marge).`,
    })
  }
  return base({
    mode: 'grace', plan: payload.plan, licenseId: payload.licenseId, expiresAt,
    graceUntil: bootstrapUntil, daysLeft: 0,
    lastHeartbeatAt: stored?.receivedAt ?? null,
    message: 'Aucun lease reçu de license.kamaloka.ai — grâce dépassée. Vérifiez la connexion ou contactez Kamaloka.',
  })
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
const HEARTBEAT_INTERVAL_MS = Math.max(6, Math.min(24, Number(process.env.LICENSE_HEARTBEAT_HOURS ?? 12))) * 60 * 60 * 1000

/**
 * Licence connectée (offre standard) : heartbeat périodique vers le control
 * plane Kamaloka, qui répond {status, lease} — lease signé Ed25519 lié à
 * l'instance, renouvelé à chaque contact. N'envoie QUE des métadonnées
 * opérationnelles — jamais de mémoires, documents, emails ou conversations.
 * Best-effort : un échec n'a aucun impact produit (le lease en cours continue
 * de courir).
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
      const post = async (path: string, body: unknown) =>
        fetch(`${HEARTBEAT_URL.replace(/\/$/, '')}${path}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10_000),
        })
      let res = await post('/v1/heartbeat', base)
      // Instance inconnue du control plane (installation récente) : activation
      // automatique — le serveur applique maxInstances et renvoie un lease.
      if (res.status === 404 || res.status === 403) {
        await post('/v1/activate', { license: licenseFile, instanceId, version })
        res = await post('/v1/heartbeat', base)
      }
      if (res.ok) {
        const body = (await res.json().catch(() => null)) as { status?: string; lease?: string } | null
        const stored = body ? await storeLeaseFromResponse(dbh, orgId, body) : { stored: false }
        console.log(`[companion] heartbeat licence envoyé${stored.stored ? ' — lease renouvelé' : ''}`)
      } else {
        console.warn(`[companion] heartbeat licence: réponse ${res.status}`)
      }
    } catch (err) {
      console.warn(`[companion] heartbeat licence ignoré: ${String(err).slice(0, 120)}`)
    }
  }
  setTimeout(beat, 30_000)
  setInterval(beat, HEARTBEAT_INTERVAL_MS)
}
