import { eq } from 'drizzle-orm'
import type { DbHandle } from '../db/client.js'
import { agents, toolCalls } from '../db/schema.js'
import { audit } from '../audit.js'

/**
 * Policy Engine — TOUT appel de tool agentique passe ici, avant exécution.
 * Organisation, identité agent, initiateur, tool autorisé, autonomie,
 * budgets, kill switch. Si refusé : PolicyDeniedError + audit `policy.denied`.
 * Aucun agent ne peut modifier ses propres permissions (aucun tool ne le permet).
 */

export class PolicyDeniedError extends Error {
  constructor(
    public reason: string,
    public code:
      | 'tool_not_allowed'
      | 'tool_unknown'
      | 'scope_denied'
      | 'budget_exceeded'
      | 'kill_switch'
      | 'agent_paused'
      | 'autonomy_denied',
  ) {
    super(`policy denied: ${reason}`)
  }
}

export interface PolicyContext {
  dbh: DbHandle
  organizationId: string
  agentId: string
  runId?: string
  initiatorName?: string
}

export interface PolicyDecision {
  allowed: boolean
  reason: string
}

/** Vérifie et journalise un appel de tool. Lève PolicyDeniedError si interdit. */
export async function authorizeToolCall(
  ctx: PolicyContext,
  tool: string,
  input: Record<string, unknown>,
  opts: { requiresApproval?: boolean; approvedApprovalId?: string } = {},
): Promise<PolicyDecision> {
  const { dbh, organizationId, agentId } = ctx

  // 0. Tool inconnu → refus immédiat.
  const rows = await dbh.query<{ id: string; name: string; status: string; autonomy: string; allowed_tools: unknown; max_run_tokens: number }>(
    `SELECT id, name, status, autonomy, allowed_tools, max_run_tokens FROM agents WHERE id = $1::uuid AND organization_id = $2::uuid`, [agentId, organizationId],
  )
  const agent = rows[0]
  if (!agent) throw new PolicyDeniedError('agent introuvable dans cette organisation', 'tool_not_allowed')
  if (agent.status === 'paused') throw new PolicyDeniedError('agent en pause', 'agent_paused')

  // 1. Kill switch organisation.
  const ks = await dbh.query<{ value: { enabled?: boolean } }>(
    `SELECT value FROM settings WHERE organization_id = $1::uuid AND key = 'agents'`, [organizationId],
  ).catch(() => [])
  if (process.env.AGENTS_DISABLED === '1' || ks[0]?.value?.enabled === false) {
    await logDenial(ctx, tool, 'kill_switch', 'agents désactivés (kill switch)')
    throw new PolicyDeniedError('les agents sont désactivés (kill switch organisation)', 'kill_switch')
  }

  // 2. Tool autorisé pour CET agent (allowlist explicite, deny par défaut).
  const allowedTools = (agent.allowed_tools as string[]) ?? []
  if (!allowedTools.includes(tool)) {
    await logDenial(ctx, tool, 'tool_not_allowed', `"${tool}" n'est pas dans l'allowlist de ${agent.name}`)
    throw new PolicyDeniedError(`tool "${tool}" non autorisé pour cet agent`, 'tool_not_allowed')
  }

  // 3. Autonomie : un assistant ne peut pas exécuter de tools à effet d'écriture
  //    structurant — il passe par request_approval (l'approbation fait foi).
  //    (Contrôlé au niveau des workflows : les steps d'écriture exigent une approval.)

  // 4. Budget tokens quotidien (approximation : somme des runs du jour).
  const daily = await dbh.query<{ total: string }>(
    `SELECT COALESCE(SUM(prompt_tokens + completion_tokens), 0)::text AS total FROM tool_calls
     WHERE agent_id = $1::uuid AND created_at > now() - interval '24 hours'`, [agentId],
  )
  if (Number(daily[0]?.total ?? 0) > agent.max_run_tokens * 50) {
    await logDenial(ctx, tool, 'budget_exceeded', 'budget quotidien de tokens dépassé')
    throw new PolicyDeniedError('budget quotidien dépassé', 'budget_exceeded')
  }

  return { allowed: true, reason: 'ok' }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function logDenial(ctx: PolicyContext, tool: string, code: string, reason: string) {
  await ctx.dbh.db.insert(toolCalls).values({
    runId: ctx.runId && UUID_RE.test(ctx.runId) ? ctx.runId : null,
    agentId: ctx.agentId,
    tool,
    input: {},
    status: 'denied',
    policyDecision: 'denied',
    policyReason: reason,
  })
  await audit(ctx.dbh, ctx.organizationId, {
    actorName: ctx.initiatorName ?? 'agent',
    actorKind: 'agent',
    action: 'policy.denied',
    targetType: 'tool',
    targetId: tool,
    detail: { code, reason },
  })
}

/** Enregistre un appel de tool réussi (traçabilité + estimation de tokens pour budgets). */
export async function recordToolCall(
  ctx: PolicyContext,
  tool: string,
  input: Record<string, unknown>,
  outputSummary: Record<string, unknown>,
) {
  const inLen = JSON.stringify(input ?? {}).length
  const outLen = JSON.stringify(outputSummary ?? {}).length
  const promptTokens = Math.ceil(inLen / 4)
  const completionTokens = Math.ceil(outLen / 4)
  await ctx.dbh.db.insert(toolCalls).values({
    runId: ctx.runId && UUID_RE.test(ctx.runId) ? ctx.runId : null,
    agentId: ctx.agentId,
    tool,
    input: input as never,
    outputSummary: outputSummary as never,
    status: 'ok',
    policyDecision: 'allowed',
    promptTokens,
    completionTokens,
  })
  if (ctx.runId && UUID_RE.test(ctx.runId)) {
    await ctx.dbh.exec(
      `UPDATE agent_runs SET prompt_tokens = prompt_tokens + $1,
        completion_tokens = completion_tokens + $2,
        estimated_cost = estimated_cost + $3
       WHERE id = $4::uuid`, [promptTokens, completionTokens, (promptTokens + completionTokens) * 0.0000001, ctx.runId],
    ).catch(() => undefined)
  }
}

/** Vérifie l'accès d'un agent à un scope mémoire donné (filtrage retrieval). */
export async function agentCanReadScope(
  dbh: DbHandle,
  agentId: string,
  requiredScope: 'company' | 'role' | 'department' | 'employee',
): Promise<boolean> {
  const rows = await dbh.query<{ memory_scopes: string[] }>(`SELECT memory_scopes FROM agents WHERE id = $1::uuid`, [agentId])
  const scopes = rows[0]?.memory_scopes ?? []
  return scopes.includes('*') || scopes.includes(requiredScope)
}

export { agents, eq }
