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
    `SELECT failed_login_count, locked_until FROM users WHERE email = $1`,
    [email],
  )
  const u = rows[0]
  if (!u?.locked_until) return { locked: false }
  const lockedUntil = new Date(u.locked_until)
  if (lockedUntil > new Date()) {
    return { locked: true, minutesRemaining: Math.ceil((lockedUntil.getTime() - Date.now()) / 60000) }
  }
  // Déverrouillage automatique
  await dbh.exec(`UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE email = $1`, [email])
  return { locked: false }
}

export async function recordFailedLogin(dbh: DbHandle, email: string) {
  await dbh.exec(`UPDATE users SET failed_login_count = failed_login_count + 1 WHERE email = $1`, [email])
  const rows = await dbh.query<{ failed_login_count: number }>(`SELECT failed_login_count FROM users WHERE email = $1`, [email])
  if ((rows[0]?.failed_login_count ?? 0) >= LOCKOUT_THRESHOLD) {
    await dbh.exec(`UPDATE users SET locked_until = now() + make_interval(mins => $1) WHERE email = $2`, [LOCKOUT_DURATION_MIN, email])
  }
}

export async function resetFailedLogins(dbh: DbHandle, email: string) {
  await dbh.exec(`UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE email = $1`, [email])
}

/* --------------------------- PASSWORD RESET ------------------------------- */

export async function createPasswordReset(dbh: DbHandle, email: string): Promise<string | null> {
  const rows = await dbh.query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email])
  const user = rows[0]
  if (!user) return null // Ne pas révéler si l'email existe
  const token = generateToken()
  await dbh.exec(
    `INSERT INTO password_resets (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '1 hour')`, [user.id, hashToken(token)],
  )
  return token // En production : envoyer par email. En dev : retourner pour test.
}

export async function resetPassword(dbh: DbHandle, token: string, newPassword: string): Promise<boolean> {
  const rows = await dbh.query<{ user_id: string; used_at: string | null }>(
    `SELECT user_id, used_at FROM password_resets WHERE token_hash = $1 AND expires_at > now() AND used_at IS NULL`, [hashToken(token)],
  )
  const reset = rows[0]
  if (!reset) return false
  const hash = await hashPassword(newPassword)
  await dbh.exec(`UPDATE users SET password_hash = $1, password_hash_updated_at = now(), failed_login_count = 0, locked_until = NULL WHERE id = $2::uuid`, [hash, reset.user_id])
  await dbh.exec(`UPDATE password_resets SET used_at = now() WHERE token_hash = $1`, [hashToken(token)])
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
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [organizationId, email, role, hashToken(token), invitedBy ?? null, invitedByName],
  )
  return { invitationId: rows[0].id, token }
}

export async function acceptInvitation(dbh: DbHandle, token: string, password: string, firstName: string, lastName: string): Promise<boolean> {
  const rows = await dbh.query<{ id: string; organization_id: string; email: string; role: string }>(
    `SELECT id, organization_id, email, role FROM invitations WHERE token_hash = $1 AND status = 'pending' AND expires_at > now()`, [hashToken(token)],
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
  await dbh.exec(`UPDATE invitations SET status = 'accepted' WHERE id = $1::uuid`, [inv.id])
  return Boolean(newUser)
}

/* ------------------------------- SESSIONS --------------------------------- */

export async function getUserSessions(dbh: DbHandle, userId: string) {
  return dbh.query(
    `SELECT id, device, ip_address, created_at::text AS created_at, last_active_at::text AS last_active_at
     FROM user_sessions WHERE user_id = $1::uuid AND revoked_at IS NULL ORDER BY last_active_at DESC`, [userId],
  )
}

export async function revokeSession(dbh: DbHandle, sessionId: string, userId: string) {
  await dbh.exec(`UPDATE user_sessions SET revoked_at = now() WHERE id = $1::uuid AND user_id = $2::uuid`, [sessionId, userId])
}

export async function revokeAllOtherSessions(dbh: DbHandle, userId: string, currentSessionHash: string) {
  await dbh.exec(`UPDATE user_sessions SET revoked_at = now() WHERE user_id = $1::uuid AND session_token_hash != $2 AND revoked_at IS NULL`, [userId, currentSessionHash])
}
