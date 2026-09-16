import crypto from 'node:crypto'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import type { DbHandle } from '../db/client.js'
import { users, invitations, passwordResets, emailVerifications, userSessions } from '../db/schema.js'
import { hashPassword, verifyPassword } from '../auth.js'
import { audit } from '../audit.js'

/**
 * Auth complet : password reset, invitations, email verification, lockout, sessions.
 * Les tokens sont hashés en base — jamais stockés en clair.
 */

const LOCKOUT_THRESHOLD = 5
const LOCKOUT_DURATION_MIN = 15

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/* ------------------------------ LOCKOUT ---------------------------------- */

export async function checkLockout(dbh: DbHandle, email: string): Promise<{ locked: boolean; minutesRemaining?: number }> {
  const rows = await dbh.query<{ failed_login_count: number; locked_until: string | null }>(
    `SELECT failed_login_count, locked_until FROM users WHERE email = '${email.replace(/'/g, "''")}'`,
  )
  const u = rows[0]
  if (!u?.locked_until) return { locked: false }
  const lockedUntil = new Date(u.locked_until)
  if (lockedUntil > new Date()) {
    return { locked: true, minutesRemaining: Math.ceil((lockedUntil.getTime() - Date.now()) / 60000) }
  }
  // Déverrouillage automatique
  await dbh.exec(`UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE email = '${email.replace(/'/g, "''")}'`)
  return { locked: false }
}

export async function recordFailedLogin(dbh: DbHandle, email: string) {
  const safe = email.replace(/'/g, "''")
  await dbh.exec(`UPDATE users SET failed_login_count = failed_login_count + 1 WHERE email = '${safe}'`)
  const rows = await dbh.query<{ failed_login_count: number }>(`SELECT failed_login_count FROM users WHERE email = '${safe}'`)
  if ((rows[0]?.failed_login_count ?? 0) >= LOCKOUT_THRESHOLD) {
    await dbh.exec(`UPDATE users SET locked_until = now() + interval '${LOCKOUT_DURATION_MIN} minutes' WHERE email = '${safe}'`)
  }
}

export async function resetFailedLogins(dbh: DbHandle, email: string) {
  await dbh.exec(`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE email = '${email.replace(/'/g, "''")}'`)
}

/* --------------------------- PASSWORD RESET ------------------------------- */

export async function createPasswordReset(dbh: DbHandle, email: string): Promise<string | null> {
  const rows = await dbh.query<{ id: string }>(`SELECT id FROM users WHERE email = '${email.replace(/'/g, "''")}'`)
  const user = rows[0]
  if (!user) return null // Ne pas révéler si l'email existe
  const token = generateToken()
  await dbh.exec(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ('${user.id}', '${hashToken(token)}', now() + interval '1 hour')`,
  )
  return token // En production : envoyer par email. En dev : retourner pour test.
}

export async function resetPassword(dbh: DbHandle, token: string, newPassword: string): Promise<boolean> {
  const rows = await dbh.query<{ user_id: string; used_at: string | null }>(
    `SELECT user_id, used_at FROM password_resets WHERE token_hash = '${hashToken(token)}' AND expires_at > now() AND used_at IS NULL`,
  )
  const reset = rows[0]
  if (!reset) return false
  const hash = await hashPassword(newPassword)
  await dbh.exec(`UPDATE users SET password_hash = '${hash}', password_hash_updated_at = now(), failed_login_count = 0, locked_until = NULL WHERE id = '${reset.user_id}'`)
  await dbh.exec(`UPDATE password_resets SET used_at = now() WHERE token_hash = '${hashToken(token)}'`)
  return true
}

/* ----------------------------- INVITATIONS -------------------------------- */

export async function createInvitation(
  dbh: DbHandle,
  organizationId: string,
  email: string,
  role: string,
  invitedBy: string,
  invitedByName: string,
): Promise<{ invitationId: string; token: string }> {
  const token = generateToken()
  const rows = await dbh.query<{ id: string }>(
    `INSERT INTO invitations (organization_id, email, role, token_hash, invited_by, invited_by_name)
     VALUES ('${organizationId}', '${email.replace(/'/g, "''")}', '${role}', '${hashToken(token)}', ${invitedBy ? `'${invitedBy}'` : 'NULL'}, '${invitedByName.replace(/'/g, "''")}')
     RETURNING id`,
  )
  return { invitationId: rows[0].id, token }
}

export async function acceptInvitation(dbh: DbHandle, token: string, password: string, firstName: string, lastName: string): Promise<boolean> {
  const rows = await dbh.query<{ id: string; organization_id: string; email: string; role: string }>(
    `SELECT id, organization_id, email, role FROM invitations WHERE token_hash = '${hashToken(token)}' AND status = 'pending' AND expires_at > now()`,
  )
  const inv = rows[0]
  if (!inv) return false
  const hash = await hashPassword(password)
  const [newUser] = await dbh.db.insert(users).values({
    organizationId: inv.organization_id,
    email: inv.email,
    passwordHash: hash,
    name: `${firstName} ${lastName}`,
    appRole: inv.role,
  }).returning()
  await dbh.exec(`UPDATE invitations SET status = 'accepted' WHERE id = '${inv.id}'`)
  return Boolean(newUser)
}

/* ------------------------------- SESSIONS --------------------------------- */

export async function getUserSessions(dbh: DbHandle, userId: string) {
  return dbh.query(
    `SELECT id, device, ip_address, created_at::text AS created_at, last_active_at::text AS last_active_at
     FROM user_sessions WHERE user_id = '${userId}' AND revoked_at IS NULL ORDER BY last_active_at DESC`,
  )
}

export async function revokeSession(dbh: DbHandle, sessionId: string, userId: string) {
  await dbh.exec(`UPDATE user_sessions SET revoked_at = now() WHERE id = '${sessionId}' AND user_id = '${userId}'`)
}

export async function revokeAllOtherSessions(dbh: DbHandle, userId: string, currentSessionHash: string) {
  await dbh.exec(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = '${userId}' AND session_token_hash != '${currentSessionHash}' AND revoked_at IS NULL`)
}
