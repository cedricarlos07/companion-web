import crypto from 'node:crypto'
import fs from 'node:fs'

/**
 * Clés de signature Ed25519 de l'ÉDITEUR.
 * La clé privée vit UNIQUEMENT ici (Kamaloka) — jamais dans Companion.
 * Dev : paire générée au premier boot et persistée dans data/keys.json.
 * Prod : LICENSE_SIGNING_PRIVATE_KEY / LICENSE_SIGNING_PUBLIC_KEY en env.
 */

export interface LicensePayload {
  licenseId: string
  organization: string
  plan: 'pilot' | 'business' | 'enterprise'
  issuedAt: string
  expiresAt: string | null
  entitlements: Record<string, unknown>
}

let cached: { privateKey: string; publicKey: string } | null = null

export function getKeys(): { privateKey: string; publicKey: string } {
  if (cached) return cached
  const envPriv = process.env.LICENSE_SIGNING_PRIVATE_KEY
  const envPub = process.env.LICENSE_SIGNING_PUBLIC_KEY
  if (envPriv && envPub) {
    cached = { privateKey: envPriv.replace(/\\n/g, '\n'), publicKey: envPub.replace(/\\n/g, '\n') }
    return cached
  }
  const keyFile = process.env.CC_KEYS_FILE ?? './data/keys.json'
  if (fs.existsSync(keyFile)) {
    cached = JSON.parse(fs.readFileSync(keyFile, 'utf8'))
    return cached!
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519')
  cached = {
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  }
  fs.mkdirSync(String(process.env.CC_DATA_DIR ?? './data'), { recursive: true })
  fs.writeFileSync(keyFile, JSON.stringify(cached, null, 2))
  console.log('[cc] paire de clés de signature générée (dev) →', keyFile)
  return cached!
}

/**
 * Émet le contenu du fichier .lic — format identique à celui que Companion
 * vérifie : base64(JSON.stringify({ payload, signature: base64 })).
 */
export function signLicense(payload: LicensePayload, privateKeyPem: string): string {
  const data = JSON.stringify(payload)
  const signature = crypto.sign(null, Buffer.from(data), privateKeyPem)
  return Buffer.from(JSON.stringify({ payload, signature: signature.toString('base64') })).toString('base64')
}

export function issueLicenseFile(payload: LicensePayload): string {
  return signLicense(payload, getKeys().privateKey)
}
