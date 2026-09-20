import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { DbHandle } from '../db/client.js'

/**
 * License self-hosted signée Ed25519.
 * L'éditeur signe avec sa private key. Companion embarque uniquement la public key.
 * Offline : le client importe/paste la licence, Companion vérifie localement.
 * Jamais de private signing key dans Companion.
 */

const PUBLIC_KEY = process.env.LICENSE_PUBLIC_KEY ?? ''

/**
 * Sans LICENSE_PUBLIC_KEY (dev uniquement) : paire persistée sur disque pour
 * rester stable entre les redémarrages (sinon toute licence redeviendrait
 * « invalide » au reboot). En production la clé publique de Kamaloka est
 * toujours fournie via l'environnement.
 */
function loadDevKeys(): { publicKey: crypto.KeyObject; privateKey: crypto.KeyObject } | null {
  if (PUBLIC_KEY) return null
  const keyFile = path.join(process.env.COMPANION_DATA_DIR ?? './data', 'license-dev-keys.json')
  try {
    if (fs.existsSync(keyFile)) {
      const saved = JSON.parse(fs.readFileSync(keyFile, 'utf8')) as { publicKey: string; privateKey: string }
      return {
        publicKey: crypto.createPublicKey(saved.publicKey),
        privateKey: crypto.createPrivateKey(saved.privateKey),
      }
    }
  } catch {
    /* regénération en dessous */
  }
  const pair = crypto.generateKeyPairSync('ed25519')
  const keys = { publicKey: pair.publicKey, privateKey: pair.privateKey }
  try {
    fs.mkdirSync(path.dirname(keyFile), { recursive: true })
    fs.writeFileSync(keyFile, JSON.stringify({
      publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
      privateKey: keys.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
    }, null, 2))
  } catch {
    /* disque non inscriptible : paire en mémoire seulement */
  }
  return keys
}

const DEV_KEYS = loadDevKeys()

const ACTIVE_PUBLIC_KEY = PUBLIC_KEY || DEV_KEYS?.publicKey.export({ type: 'spki', format: 'pem' }).toString() || ''

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

/** Signature avec la paire éphémère de dev — jamais disponible en production. */
export function devSignLicense(payload: LicensePayload): string {
  if (!DEV_KEYS) throw new Error('devSignLicense indisponible : LICENSE_PUBLIC_KEY est configurée')
  const pem = DEV_KEYS.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  return signLicense(payload, pem)
}

/** Vérifie une licence signée localement. */
export function verifyLicense(encoded: string): LicenseVerification {
  if (!ACTIVE_PUBLIC_KEY) {
    return { valid: false, status: 'not_configured', error: 'LICENSE_PUBLIC_KEY non configurée' }
  }
  try {
    const { payload, signature } = JSON.parse(Buffer.from(encoded, 'base64').toString())
    const data = JSON.stringify(payload)
    const valid = crypto.verify(null, Buffer.from(data), ACTIVE_PUBLIC_KEY, Buffer.from(signature, 'base64'))
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
      `SELECT signature, status, grace_until FROM licenses
       WHERE organization_id = $1::uuid AND status NOT IN ('revoked', 'replaced')
       ORDER BY created_at DESC LIMIT 1`, [organizationId],
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

/* ------------------------------- Lease ------------------------------------ */

/**
 * Lease signé renvoyé par le Control Center en réponse au heartbeat
 * (licence connectée). Là où la licence file longue durée, le lease court
 * (7 j par défaut côté serveur) : une révocation côté Kamaloka finit donc
 * TOUJOURS par s'appliquer — au pire à l'expiration du lease en cours,
 * jamais par kill brutal. Le client ne peut pas en forger : la clé privée
 * ne quitte jamais Kamaloka, seule la public key est embarquée ici.
 */
export interface LeasePayload {
  kind: 'companion-lease'
  licenseId: string
  instanceId: string
  plan: string
  status: 'ACTIVE' | 'GRACE'
  entitlements: Record<string, unknown>
  issuedAt: string
  validUntil: string
}

export interface LeaseVerification {
  valid: boolean
  status: 'active' | 'expired' | 'invalid' | 'not_configured'
  payload?: LeasePayload
  error?: string
}

/** Signe un lease (côté éditeur / Control Center uniquement). */
export function signLease(payload: LeasePayload, privateKeyPem: string): string {
  const data = JSON.stringify(payload)
  const signature = crypto.sign(null, Buffer.from(data), privateKeyPem)
  return Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') })).toString('base64')
}

/** Signature de lease avec la paire éphémère de dev — jamais en production. */
export function devSignLease(payload: LeasePayload): string {
  if (!DEV_KEYS) throw new Error('devSignLease indisponible : LICENSE_PUBLIC_KEY est configurée')
  const pem = DEV_KEYS.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  return signLease(payload, pem)
}

/** Vérifie un lease signé localement (signature + validUntil). */
export function verifyLease(encoded: string): LeaseVerification {
  if (!ACTIVE_PUBLIC_KEY) {
    return { valid: false, status: 'not_configured', error: 'LICENSE_PUBLIC_KEY non configurée' }
  }
  try {
    const { payload, signature } = JSON.parse(Buffer.from(encoded, 'base64').toString())
    if (payload?.kind !== 'companion-lease') {
      return { valid: false, status: 'invalid', error: 'payload lease invalide' }
    }
    const data = JSON.stringify(payload)
    const valid = crypto.verify(null, Buffer.from(data), ACTIVE_PUBLIC_KEY, Buffer.from(signature, 'base64'))
    if (!valid) return { valid: false, status: 'invalid', error: 'signature de lease invalide' }
    if (payload.validUntil && new Date(payload.validUntil) < new Date()) {
      return { valid: false, status: 'expired', payload, error: `lease expiré le ${payload.validUntil}` }
    }
    return { valid: true, status: 'active', payload }
  } catch (err) {
    return { valid: false, status: 'invalid', error: String(err).slice(0, 200) }
  }
}
