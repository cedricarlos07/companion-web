import crypto from 'node:crypto'
import type { DbHandle } from '../db/client.js'

/**
 * License self-hosted signée Ed25519.
 * L'éditeur signe avec sa private key. Companion embarque uniquement la public key.
 * Offline : le client importe/paste la licence, Companion vérifie localement.
 * Jamais de private signing key dans Companion.
 */

const PUBLIC_KEY = process.env.LICENSE_PUBLIC_KEY ?? ''

export interface LicensePayload {
  licenseId: string
  organization: string
  plan: 'pilot' | 'business' | 'enterprise'
  issuedAt: string
  expiresAt: string | null
  entitlements: Record<string, unknown>
}

export interface LicenseVerification {
  valid: boolean
  status: 'active' | 'expired' | 'invalid' | 'not_configured'
  payload?: LicensePayload
  error?: string
}

/** Génère une paire de clés Ed25519 (outil admin, pas embarqué en production). */
export function generateLicenseKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  return {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
}

/** Signe une licence (côté éditeur uniquement). */
export function signLicense(payload: LicensePayload, privateKeyPem: string): string {
  const data = JSON.stringify(payload)
  const signature = crypto.sign(null, Buffer.from(data), privateKeyPem)
  return Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') })).toString('base64')
}

/** Vérifie une licence signée localement. */
export function verifyLicense(encoded: string): LicenseVerification {
  if (!PUBLIC_KEY) {
    return { valid: false, status: 'not_configured', error: 'LICENSE_PUBLIC_KEY non configurée' }
  }
  try {
    const { payload, signature } = JSON.parse(Buffer.from(encoded, 'base64').toString())
    const data = JSON.stringify(payload)
    const valid = crypto.verify(null, Buffer.from(data), PUBLIC_KEY, Buffer.from(signature, 'base64'))
    if (!valid) return { valid: false, status: 'invalid', error: 'signature invalide' }
    if (payload.expiresAt && new Date(payload.expiresAt) < new Date()) {
      return { valid: false, status: 'expired', payload, error: `licence expirée le ${payload.expiresAt}` }
    }
    return { valid: true, status: 'active', payload }
  } catch (err) {
    return { valid: false, status: 'invalid', error: String(err).slice(0, 200) }
  }
}

/** Vérifie le statut de licence de l'organisation (base + signature). */
export async function checkLicenseStatus(dbh: DbHandle, organizationId: string): Promise<LicenseVerification & { graceUntil?: string }> {
  const rows = await dbh
    .query<{ signature: string; status: string; grace_until: string | null }>(
      `SELECT signature, status, grace_until FROM licenses WHERE organization_id = '${organizationId}' ORDER BY created_at DESC LIMIT 1`,
    )
    .catch(() => [])
  if (!rows[0]) {
    // Pas de licence = trial automatique.
    return { valid: true, status: 'active', error: undefined }
  }
  const verification = verifyLicense(rows[0].signature)
  if (!verification.valid && rows[0].grace_until && new Date(rows[0].grace_until) > new Date()) {
    return { ...verification, graceUntil: rows[0].grace_until }
  }
  return verification
}
