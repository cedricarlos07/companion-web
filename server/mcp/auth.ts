import crypto from 'node:crypto'
import type { DbHandle } from '../db/client.js'

/**
 * Auth MCP — Bearer token → sha256 → lookup `mcp_clients`.
 * Le token n'est JAMAIS stocké en clair. Aucun accès anonyme.
 */

export interface McpClientRow {
  id: string
  organization_id: string
  name: string
  status: string
  allowed_scopes: string[]
  allowed_tools: string[]
  expires_at: string | null
}

export interface McpCallContext {
  organizationId: string
  mcpClientId: string
  clientName: string
  actorType: 'mcp_client'
  allowedScopes: string[]
  allowedTools: string[]
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/** Génère un token opaque affiché une seule fois. */
export function generateToken(): string {
  return `cmpk_${crypto.randomBytes(24).toString('hex')}`
}

export async function verifyMcpToken(dbh: DbHandle, token: string): Promise<McpClientRow | null> {
  const hash = hashToken(token)
  const rows = await dbh.query<McpClientRow & { expires_at: string | null }>(
    `SELECT id, organization_id, name, status, allowed_scopes, allowed_tools, expires_at
     FROM mcp_clients WHERE token_hash = $1`, [hash],
  )
  const client = rows[0]
  if (!client) return null
  if (client.status !== 'active') return null
  if (client.expires_at && new Date(client.expires_at) < new Date()) return null
  await dbh.exec(`UPDATE mcp_clients SET last_used_at = now() WHERE id = $1::uuid`, [client.id])
  return client
}

export function toCallContext(client: McpClientRow): McpCallContext {
  return {
    organizationId: client.organization_id,
    mcpClientId: client.id,
    clientName: client.name,
    actorType: 'mcp_client',
    allowedScopes: client.allowed_scopes ?? [],
    allowedTools: client.allowed_tools ?? [],
  }
}
