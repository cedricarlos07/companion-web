import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { PolicyDeniedError } from '../mastra/policy.js'
export { PolicyDeniedError }
import type { McpCallContext } from './auth.js'

/** Rate limiter en mémoire — fenêtre glissante 60 s par client MCP. */
const RATE_WINDOW_MS = 60_000
const RATE_MAX_REQUESTS = 60
const rateBuckets = new Map<string, number[]>()

export function checkRateLimit(clientId: string, max = RATE_MAX_REQUESTS): boolean {
  const now = Date.now()
  const bucket = (rateBuckets.get(clientId) ?? []).filter((t) => now - t < RATE_WINDOW_MS)
  if (bucket.length >= max) {
    rateBuckets.set(clientId, bucket)
    return false
  }
  bucket.push(now)
  rateBuckets.set(clientId, bucket)
  return true
}

/**
 * Policy MCP — allowlist de tools du client + scopes (deny par défaut).
 * Toute exception PolicyDeniedError est convertie en erreur MCP + audit.
 */
export async function authorizeToolCall(
  dbh: DbHandle,
  client: McpCallContext,
  tool: string,
  target?: { employeeId?: string; roleId?: string; departmentId?: string },
): Promise<void> {
  const allowedTools = client.allowedTools ?? []
  if (!allowedTools.includes(tool) && !allowedTools.includes('*')) {
    await audit(dbh, client.organizationId, {
      actorName: client.clientName, actorKind: 'agent',
      action: 'mcp.policy.denied', targetType: 'mcp_tool', targetId: tool,
      detail: { reason: `tool "${tool}" non autorisé pour ce client MCP` },
    })
    throw new PolicyDeniedError(`tool "${tool}" non autorisé pour ce client MCP`, 'tool_not_allowed')
  }

  // Scope mémoire : un client scoped ne peut pas toucher un hors-périmètre.
  if (target?.employeeId) {
    const emp = await dbh
      .query<{ department_id: string | null }>(`SELECT department_id FROM employees WHERE id = $1::uuid AND organization_id = $2::uuid`, [target.employeeId, client.organizationId])
      .catch(() => [])
    if (!emp[0]) {
      throw new PolicyDeniedError('employé introuvable dans cette organisation (cross-org refusé)', 'scope_denied')
    }
    const scopes = client.allowedScopes ?? []
    const covered =
      scopes.includes('*') ||
      scopes.includes('employee') ||
      (emp[0].department_id && (scopes.includes('department') || scopes.includes(`department:${emp[0].department_id}`)))
    if (!covered) {
      await audit(dbh, client.organizationId, {
        actorName: client.clientName, actorKind: 'agent',
        action: 'mcp.policy.denied', targetType: 'mcp_tool', targetId: tool,
        detail: { reason: 'périmètre employé hors scopes du client' },
      })
      throw new PolicyDeniedError('périmètre employé hors scopes du client', 'scope_denied')
    }
  }
  if (target?.roleId) {
    const role = await dbh
      .query<{ title: string | null }>(`SELECT title FROM roles WHERE id = $1::uuid AND organization_id = $2::uuid`, [target.roleId, client.organizationId])
      .catch(() => [])
    if (!role[0]) {
      throw new PolicyDeniedError('rôle introuvable dans cette organisation (cross-org refusé)', 'scope_denied')
    }
    const scopes = client.allowedScopes ?? []
    const covered =
      scopes.includes('*') || scopes.includes('role') || (role[0].title && scopes.includes(`role:${role[0].title}`))
    if (!covered) {
      await audit(dbh, client.organizationId, {
        actorName: client.clientName, actorKind: 'agent',
        action: 'mcp.policy.denied', targetType: 'mcp_tool', targetId: tool,
        detail: { reason: 'rôle hors scopes du client' },
      })
      throw new PolicyDeniedError('rôle hors scopes du client', 'scope_denied')
    }
  }
}
