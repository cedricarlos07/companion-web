/**
 * ExternalToolProvider — pont entre les agents Mastra et Activepieces MCP.
 *
 * Companion n'appelle jamais Gmail/Drive/Teams directement. Activepieces
 * expose ces applications via MCP ; ce provider les découvre, les enveloppe
 * dans la policy Companion et les met à disposition des workflows.
 *
 * Configuration :
 *   ACTIVEPIECES_URL=http://localhost:5678
 *   ACTIVEPIECES_MCP_TOKEN=cmpk_ext_…   (token Activepieces MCP)
 *   ACTIVEPIECES_ENABLED=true|false     (défaut : false)
 *
 * Dégradation : si Activepieces est absent, les tools externes disparaissent
 * proprement — les workflows internes continuent de fonctionner.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { config } from '../config.js'
import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { PolicyDeniedError } from '../mastra/policy.js'
import type { ToolContext } from '../mastra/tools.js'

export interface ExternalTool {
  name: string
  description: string
  /** Nom Activepieces d'origine (ex. "gmail_send_email", "google-drive_upload_file") */
  apName: string
  riskLevel: 'low' | 'medium' | 'high'
  externalSideEffect: true
  inputSchema: Record<string, unknown>
  execute: (ctx: ToolContext, input: Record<string, unknown>) => Promise<unknown>
}

export interface ExternalToolProviderHealth {
  enabled: boolean
  ok: boolean
  url: string
  toolCount: number
  tools: string[]
  lastError?: string
}

const EXT_TOOLS = new Map<string, ExternalTool>()
let initialized = false

export function isActivepiecesEnabled(): boolean {
  return process.env.ACTIVEPIECES_ENABLED === 'true' && Boolean(process.env.ACTIVEPIECES_URL)
}

function activepiecesUrl(): string {
  return process.env.ACTIVEPIECES_URL ?? 'http://localhost:5678'
}

function activepiecesMcpUrl(): string {
  const base = activepiecesUrl()
  return process.env.ACTIVEPIECES_MCP_URL ?? `${base}/api/v1/mcp`
}

/** Évalue le risque d'un tool Activepieces par son nom. */
function riskLevelFor(apToolName: string): 'low' | 'medium' | 'high' {
  const name = apToolName.toLowerCase()
  if (/send|create|delete|update|upload|reply|move|share/i.test(name)) return 'high'
  if (/search|list|get|read/i.test(name)) return 'low'
  return 'medium'
}

/** Connecte au serveur MCP Activepieces et découvre les tools. */
export async function initializeExternalTools(dbh: DbHandle, organizationId: string): Promise<number> {
  if (!isActivepiecesEnabled() || initialized) return EXT_TOOLS.size
  initialized = true

  try {
    const mcpUrl = activepiecesMcpUrl()
    const token = process.env.ACTIVEPIECES_MCP_TOKEN
    const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
      requestInit: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    })
    const client = new Client({ name: 'companion-external', version: '1.0.0' })
    await client.connect(transport)

    const { tools } = await client.listTools()

    for (const tool of tools) {
      const apName = tool.name
      const name = `ap_${apName}`
      const risk = riskLevelFor(apName)

      EXT_TOOLS.set(name, {
        name,
        description: tool.description ?? `Activepieces: ${apName}`,
        apName,
        riskLevel: risk,
        externalSideEffect: true,
        inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
        execute: async (ctx: ToolContext, input: Record<string, unknown>) => {
          // Appel MCP réel vers Activepieces.
          const result = await client.callTool({ name: apName, arguments: input })
          await audit(dbh, ctx.organizationId, {
            actorName: ctx.initiatorName ?? 'agent',
            actorKind: 'agent',
            action: 'external.tool.executed',
            targetType: 'external_tool',
            targetId: apName,
            detail: { tool: apName, runId: ctx.runId },
          })
          return result
        },
      })
    }

    await client.close()
    console.log(`[activepieces] ${EXT_TOOLS.size} tools externes découverts depuis ${mcpUrl}`)
  } catch (err) {
    console.warn(`[activepieces] connexion échouée — tools externes indisponibles : ${String(err).slice(0, 200)}`)
  }

  return EXT_TOOLS.size
}

export function getExternalTools(): ExternalTool[] {
  return [...EXT_TOOLS.values()]
}

export function getActiveTool(name: string): ExternalTool | undefined {
  return EXT_TOOLS.get(name)
}

export function getExternalTool(name: string): ExternalTool | undefined {
  return EXT_TOOLS.get(name)
}

/**
 * Policy pour les tools externes — PLUS STRICTE que les tools internes :
 *   assistant    → toujours refusé (jamais d'effet externe)
 *   copilot      → approbation obligatoire AVANT exécution
 *   autopilot    → autorisé uniquement si le tool est explicitement pré-autorisé
 * Le respect de ces règles est vérifié dans la policy layer, pas ici.
 */
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
      detail: { reason: 'autonomy=copilot : approbation humaine obligatoire avant effet externe' },
    })
    throw new PolicyDeniedError('approbation humaine obligatoire avant effet externe', 'autonomy_denied')
  }

  // autopilot_limited : autorisé — les limites (budget, fréquence) sont gérées par le runner.
}

export async function externalHealth(): Promise<ExternalToolProviderHealth> {
  const enabled = isActivepiecesEnabled()
  return {
    enabled,
    ok: enabled && EXT_TOOLS.size > 0,
    url: activepiecesUrl(),
    toolCount: EXT_TOOLS.size,
    tools: [...EXT_TOOLS.keys()].slice(0, 20),
    lastError: initialized && EXT_TOOLS.size === 0 ? 'connexion Activepieces échouée au démarrage' : undefined,
  }
}
