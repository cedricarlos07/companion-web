/**
 * Client du Control Center KamaLoka — portail client.
 *
 * Le portail dialogue DIRECTEMENT avec le Control Center (URL + token portail
 * par licence, fournis par KamaLoka). Session conservée en localStorage ;
 * aucune donnée métier ne transite par ce portail — uniquement licence,
 * instances, factures et versions.
 */

export interface PortalSession {
  baseUrl: string
  token: string
}

const SESSION_KEY = 'kamaloka-portal-session'

export function readPortalSession(): PortalSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PortalSession>
    if (typeof parsed.baseUrl !== 'string' || typeof parsed.token !== 'string') return null
    return { baseUrl: parsed.baseUrl.replace(/\/$/, ''), token: parsed.token }
  } catch {
    return null
  }
}

export function savePortalSession(session: PortalSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearPortalSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export interface PortalInstance {
  instanceId: string
  version: string | null
  lastSeen: string | null
  revoked: boolean
  lastMode: string | null
  counts: Record<string, number>
}

export interface PortalMe {
  customer: string
  licenseId: string
  plan: string
  licenseStatus: string
  expiresAt: string | null
  entitlements: Record<string, number>
  maxInstances: number
  currency: string
  cycle: string
  instances: PortalInstance[]
}

export interface PortalInvoice {
  number: string
  amount: number
  currency: string
  months: number
  method: string
  status: string
  paid_at: string
}

export interface PortalRelease {
  version: string
  channel: string
  date: string
  notes: string[]
  url: string
}

export async function portalGet<T>(session: PortalSession, path: string): Promise<T | null> {
  try {
    const res = await fetch(`${session.baseUrl}${path}`, {
      headers: { authorization: `Bearer ${session.token}` },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/** Valide une session (login du portail) — renvoie /me ou null. */
export function portalLogin(session: PortalSession): Promise<PortalMe | null> {
  return portalGet<PortalMe>(session, '/portal/api/me')
}

export function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currency}`
}
