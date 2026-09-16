import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { config } from '../config.js'
import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { PolicyDeniedError } from '../mastra/policy.js'
import type { ToolContext } from '../mastra/tools.js'

/**
 * Activepieces tool provider — registry explicite en base.
 *
 * RÈGLE FONDAMENTALE : découverte ≠ autorisation.
 * Les tools découverts via MCP arrivent en `enabled = false` dans la table
 * `ap_tool_registry`. Un administrateur doit les activer un par un. Un tool
 * désactivé n'est JAMAIS exécutable, même si Activepieces le propose.
 *
 * Namespacing : chaque tool est préfixé par son nom d'app Activepieces
 * (`gmail.send_email`, `google_drive.search_files`) pour éviter les collisions.
 */

export interface ExternalTool {
  name: string
  apName: string
  description: string
  appName: string
  riskLevel: 'low' | 'medium' | 'high'
  sideEffect: boolean
  requiresApproval: boolean
  enabled: boolean
  execute: (ctx: { dbh: DbHandle; organizationId: string; runId: string; initiatorName?: string }, input: Record<string, unknown>) => Promise<unknown>
}

export interface ExternalToolProviderHealth {
  enabled: boolean
  ok: boolean
  url: string
  toolCount: number
  enabledCount: number
  tools: string[]
  lastError?: string
}

const initialized = new Set<string>()

/** Déduit le nom d'app Activepieces depuis le nom du tool MCP (ex. `gmail_send_email` → `gmail`). */
function appNameFor(apToolName: string): string {
  const underscore = apToolName.indexOf('_')
  return underscore > 0 ? apToolName.slice(0, underscore) : 'activepieces'
}

function riskLevelFor(apToolName: string): 'low' | 'medium' | 'high' {
  const name = apToolName.toLowerCase()
  if (/send|create|delete|update|upload|reply|move|share|approve/i.test(name)) return 'high'
  if (/search|list|get|read/i.test(name)) return 'low'
  return 'medium'
}

function requiresApprovalFor(apToolName: string): boolean {
  return riskLevelFor(apToolName) !== 'low'
}

/**
 * Découvre les tools Activepieces, les enregistre en base (disabled par
 * défaut), puis construit les wrappers exécutables pour les tools activés.
 */
export async function initializeExternalTools(dbh: DbHandle, organizationId: string): Promise<number> {
  if (!isActivepiecesEnabled()) return 0
  if (initialized.has(organizationId)) return getEnabledCount(dbh, organizationId)

  const mcpUrl = process.env.ACTIVEPIECES_MCP_URL ?? `${process.env.ACTIVEPIECES_URL ?? 'http://localhost:5678'}/api/v1/mcp`
  const token = process.env.ACTIVEPIECES_MCP_TOKEN
  let discovered = 0

  try {
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
    })
    const client = new Client({ name: 'companion-discovery', version: '1.0.0' })
    await client.connect(transport)
    const { tools } = await client.listTools()
    await client.close()

    for (const tool of tools) {
      const apName = tool.name
      const appName = appNameFor(apName)
      const namespaced = `${appName}.${apName}`
      const risk = riskLevelFor(apName)

      // INSERT disabled par défaut — l'admin active manuellement.
      await dbh.exec(`
        INSERT INTO ap_tool_registry (organization_id, ap_name, namespaced_name, app_name, description, risk_level, side_effect, requires_approval, enabled)
        VALUES ('${organizationId}', '${apName.replace(/'/g, "''")}', '${namespacedName(namespaced)}', '${appName.replace(/'/g, "''")}',
                '${(tool.description ?? '').replace(/'/g, "''").slice(0, 500)}', '${risk}', true, ${requiresApprovalFor(apName)}, false)
        ON CONFLICT (organization_id, ap_name) DO UPDATE SET description = excluded.description, discovered_at = now()
      `).catch(() => undefined)
      discovered++
    }

    initialized.add(organizationId)
    const enabledCount = await getEnabledCount(dbh, organizationId)
    console.log(`[activepieces] ${discovered} tools découverts, ${enabledCount} activés en registry`)
    return enabledCount
  } catch (err) {
    console.warn(`[activepieces] découverte échouée : ${String(err).slice(0, 200)}`)
    return 0
  }
}

function namespacedName(ns: string): string {
  return ns
}

async function getEnabledCount(dbh: DbHandle, organizationId: string): Promise<number> {
  const rows = await dbh
    .query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM ap_tool_registry WHERE organization_id = '${organizationId}' AND enabled = true`)
    .catch(() => [])
  return Number(rows[0]?.cnt ?? 0)
}

/** Exécute un tool externe activé — vérifie la registry AVANT tout. */
export async function executeExternalTool(
  dbh: DbHandle,
  organizationId: string,
  namespacedName: string,
  input: Record<string, unknown>,
  runId: string,
  initiatorName?: string,
): Promise<unknown> {
  const registry = await dbh
    .query<{ enabled: boolean; ap_name: string; risk_level: string }>(
      `SELECT enabled, ap_name, risk_level FROM ap_tool_registry WHERE organization_id = '${organizationId}' AND namespaced_name = '${namespacedName.replace(/'/g, "''")}'`,
    )
    .catch(() => [])

  const entry = registry[0]
  if (!entry) throw new PolicyDeniedError(`tool "${namespacedName}" non enregistré`, 'tool_not_allowed')
  if (!entry.enabled) throw new PolicyDeniedError(`tool "${namespacedName}" désactivé — activez-le dans la registry`, 'tool_not_allowed')

  const mcpUrl = process.env.ACTIVEPIECES_MCP_URL ?? `${process.env.ACTIVEPIECES_URL ?? 'http://localhost:5678'}/api/v1/mcp`
  const token = process.env.ACTIVEPIECES_MCP_TOKEN
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  })
  const client = new Client({ name: 'companion-executor', version: '1.0.0' })
  await client.connect(transport)
  try {
    const result = await client.callTool({ name: entry.ap_name, arguments: input })
    await audit(dbh, organizationId, {
      actorName: initiatorName ?? 'agent', actorKind: 'agent',
      action: 'external.tool.executed', targetType: 'external_tool', targetId: entry.ap_name,
      detail: { namespaced: namespacedName, runId },
    })
    return result
  } finally {
    await client.close()
  }
}

/** Active/désactive un tool dans la registry (admin). */
export async function setToolEnabled(dbh: DbHandle, organizationId: string, namespacedName: string, enabled: boolean, enabledBy: string) {
  await dbh.exec(
    `UPDATE ap_tool_registry SET enabled = ${enabled}, enabled_at = ${enabled ? 'now()' : 'NULL'}, enabled_by = '${enabled ? enabledBy.replace(/'/g, "''") : 'NULL'}'
     WHERE organization_id = '${organizationId}' AND namespaced_name = '${namespacedName.replace(/'/g, "''")}'`,
  )
}

export function isActivepiecesEnabled(): boolean {
  return process.env.ACTIVEPIECES_ENABLED === 'true' && Boolean(process.env.ACTIVEPIECES_URL)
}

export async function externalHealth(): Promise<{
  enabled: boolean; ok: boolean; url: string; discoveredCount: number; enabledCount: number; lastError?: string
}> {
  const enabled = isActivepiecesEnabled()
  let enabledCount = 0
  let discoveredCount = 0
  void enabledCount
  return {
    enabled,
    ok: enabled && initialized.size > 0,
    url: process.env.ACTIVEPIECES_URL ?? 'http://localhost:5678',
    discoveredCount,
    enabledCount,
    lastError: initialized.size === 0 ? 'pas encore initialisé' : undefined,
  }
}


/** Compat : policy pour tools externes (autonomie + approbation). */
export async function authorizeExternalTool(
  dbh: DbHandle,
  organizationId: string,
  agentAutonomy: string,
  toolName: string,
  initiatorName: string,
  approvedApprovalId?: string,
): Promise<void> {
  if (!isActivepiecesEnabled()) {
    throw new PolicyDeniedError('Activepieces non configuré — tools externes indisponibles', 'kill_switch')
  }
  if (agentAutonomy === 'assistant') {
    await audit(dbh, organizationId, {
      actorName: initiatorName, actorKind: 'agent',
      action: 'policy.denied', targetType: 'external_tool', targetId: toolName,
      detail: { reason: 'autonomy=assistant : aucun tool à effet externe autorisé' },
    })
    throw new PolicyDeniedError('autonomie assistant : aucun tool à effet externe autorisé', 'autonomy_denied')
  }
  if (agentAutonomy === 'copilot' && !approvedApprovalId) {
    await audit(dbh, organizationId, {
      actorName: initiatorName, actorKind: 'agent',
      action: 'policy.denied', targetType: 'external_tool', targetId: toolName,
      detail: { reason: 'autonomy=copilot : approbation humaine obligatoire' },
    })
    throw new PolicyDeniedError('approbation humaine obligatoire avant effet externe', 'autonomy_denied')
  }
}

/** Compat : liste les tools externes activés en registry. */
export async function getEnabledTools(dbh: DbHandle, organizationId: string): Promise<{ namespaced_name: string; risk_level: string }[]> {
  return dbh.query<{ namespaced_name: string; risk_level: string }>(
    `SELECT namespaced_name, risk_level FROM ap_tool_registry WHERE organization_id = '${organizationId}' AND enabled = true`,
  ).catch(() => [])
}
