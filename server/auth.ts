import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'
import type { DbHandle } from './db/client.js'
import { users } from './db/schema.js'
import { config } from './config.js'

/**
 * Auth (JWT httpOnly cookie) + RBAC.
 * Roles: owner > admin > manager > employee > auditor ; agent (machine).
 */

export type AppRole = 'owner' | 'admin' | 'manager' | 'employee' | 'auditor' | 'agent'

export interface AuthedUser {
  id: string
  organizationId: string
  email: string
  name: string
  appRole: AppRole
  employeeId: string | null
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthedUser
    }
  }
}

const ROLE_RANK: Record<AppRole, number> = {
  owner: 60,
  admin: 50,
  manager: 40,
  agent: 30,
  employee: 20,
  auditor: 20,
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function issueToken(user: AuthedUser): string {
  return jwt.sign(
    { sub: user.id, org: user.organizationId, role: user.appRole },
    config.jwtSecret,
    { expiresIn: '12h' },
  )
}

export function setAuthCookie(res: Response, token: string) {
  res.cookie('companion_session', token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 12 * 3600 * 1000,
  })
}

export function clearAuthCookie(res: Response) {
  res.clearCookie('companion_session')
}

/** Login with email + password. Returns null when invalid. */
export async function authenticate(
  dbh: DbHandle,
  email: string,
  password: string,
): Promise<AuthedUser | null> {
  const rows = await dbh.db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1)
  const user = rows[0]
  if (!user || !user.active) return null
  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) return null
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    name: user.name,
    appRole: user.appRole as AppRole,
    employeeId: user.employeeId,
  }
}

/** Verifies the session cookie/token and attaches req.user. */
export function authRequired(dbh: DbHandle) {
  return (req: Request, res: Response, next: NextFunction) => {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined
    const token = req.cookies?.companion_session ?? bearer
    if (!token) return res.status(401).json({ error: 'non authentifié' })
    try {
      const payload = jwt.verify(token, config.jwtSecret) as { sub: string; org: string; role: AppRole }
      // Role is re-read lazily from the token; org isolation always from the token.
      req.user = {
        id: payload.sub,
        organizationId: payload.org,
        appRole: payload.role,
        email: '',
        name: '',
        employeeId: null,
      }
      next()
    } catch {
      return res.status(401).json({ error: 'session expirée' })
    }
  }
}

/** RBAC gate — allows the given roles (hierarchy-aware with minRank). */
export function requireRole(...roles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'non authentifié' })
    const userRank = ROLE_RANK[req.user.appRole] ?? 0
    const needed = Math.min(...roles.map((r) => ROLE_RANK[r] ?? 0))
    // Auditors can read anything but the route-level check is done here only for writes;
    // read endpoints typically use authRequired alone.
    if (userRank >= needed) return next()
    return res.status(403).json({ error: 'permission refusée' })
  }
}
