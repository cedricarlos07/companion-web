import type { DbHandle } from '../db/client.js'

/**
 * Entitlements — plan → limits → feature access.
 * Aucun `if plan === "enterprise"` dans le code métier.
 * Toujours passer par `can()` ou `getLimit()`.
 */

export interface Entitlements {
  'users.max': number
  'agents.max': number
  'mcpClients.max': number
  'sources.max': number
  'storage.maxGb': number
  'advancedAudit': boolean
  'sso': boolean
  'customBranding': boolean
  'prioritySupport': boolean
  'advancedBackup': boolean
}

const PLAN_LIMITS: Record<string, Entitlements> = {
  pilot: {
    'users.max': 25,
    'agents.max': 3,
    'mcpClients.max': 3,
    'sources.max': 10,
    'storage.maxGb': 5,
    'advancedAudit': false,
    'sso': false,
    'customBranding': false,
    'prioritySupport': false,
    'advancedBackup': false,
  },
  business: {
    'users.max': 100,
    'agents.max': 20,
    'mcpClients.max': 20,
    'sources.max': 100,
    'storage.maxGb': 50,
    'advancedAudit': true,
    'sso': true,
    'customBranding': false,
    'prioritySupport': true,
    'advancedBackup': true,
  },
  enterprise: {
    'users.max': 9999,
    'agents.max': 9999,
    'mcpClients.max': 9999,
    'sources.max': 9999,
    'storage.maxGb': 9999,
    'advancedAudit': true,
    'sso': true,
    'customBranding': true,
    'prioritySupport': true,
    'advancedBackup': true,
  },
}

export async function getEntitlements(dbh: DbHandle, organizationId: string): Promise<Entitlements> {
  const planRows = await dbh
    .query<{ plan: string; limits: Partial<Entitlements> }>(
      `SELECT plan, limits FROM org_entitlements WHERE organization_id = '${organizationId}'`,
    )
    .catch(() => [])
  const plan = planRows[0]?.plan ?? 'pilot'
  const base = PLAN_LIMITS[plan] ?? PLAN_LIMITS.pilot
  // Overrides de la base (custom enterprise).
  return { ...base, ...(planRows[0]?.limits ?? {}) }
}

export async function can(dbh: DbHandle, organizationId: string, feature: keyof Entitlements): Promise<boolean> {
  const ent = await getEntitlements(dbh, organizationId)
  const value = ent[feature]
  return typeof value === 'boolean' ? value : typeof value === 'number' ? value > 0 : false
}

export async function getLimit(dbh: DbHandle, organizationId: string, feature: keyof Entitlements): Promise<number> {
  const ent = await getEntitlements(dbh, organizationId)
  const value = ent[feature]
  return typeof value === 'number' ? value : 0
}

/** Vérifie une limite d'usage (ex. users.max vs count actuel). */
export async function checkLimit(
  dbh: DbHandle,
  organizationId: string,
  feature: 'users.max' | 'agents.max' | 'mcpClients.max' | 'sources.max',
  currentCount: number,
): Promise<{ allowed: boolean; limit: number; current: number }> {
  const limit = await getLimit(dbh, organizationId, feature)
  return { allowed: currentCount < limit, limit, current: currentCount }
}

export { PLAN_LIMITS }
