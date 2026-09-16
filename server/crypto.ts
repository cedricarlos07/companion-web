import crypto from 'node:crypto'

/**
 * Chiffrement AES-256-GCM pour les credentials stockés en base.
 * Clé dérivée de ENCRYPTION_KEY (env) — jamais stockée dans la base.
 */

const ALGO = 'aes-256-gcm'

function deriveKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? 'companion-dev-encryption-key-change-me'
  return crypto.createHash('sha256').update(secret).digest()
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv(ALGO, deriveKey(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decrypt(encrypted: string): string {
  const parts = encrypted.split(':')
  if (parts.length !== 4 || parts[0] !== 'v1') throw new Error('format chiffré invalide')
  const decipher = crypto.createDecipheriv(ALGO, deriveKey(), Buffer.from(parts[1], 'base64'))
  decipher.setAuthTag(Buffer.from(parts[2], 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(parts[3], 'base64')), decipher.final()]).toString('utf8')
}
