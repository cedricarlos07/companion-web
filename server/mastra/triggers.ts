import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { startAgentRun } from './runs.js'

/** skill → workflow Mastra */
export const SKILL_WORKFLOW: Record<string, string> = {
  handover_employee: 'handoverEmployeeWorkflow',
  interview_employee: 'handoverEmployeeWorkflow',
  onboard_employee: 'onboardEmployeeWorkflow',
  resolve_contradiction: 'resolveContradictionWorkflow',
  capture_knowledge: 'captureKnowledgeWorkflow',
  draft_followup: 'salesFollowupWorkflow',
  research_customer: 'salesFollowupWorkflow',
  prepare_meeting: 'salesFollowupWorkflow',
}

/**
 * Event dispatcher léger : événement → triggers activés → démarrage des
 * workflows Mastra (avec rate limit). Fire-and-forget côté routes.
 */
export async function dispatchEvent(
  dbh: DbHandle,
  organizationId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  initiatorName = 'system',
) {
  const triggers = await dbh
    .query<{ id: string; agent_key: string; skill: string; rate_limit_per_hour: number }>(
      `SELECT id, agent_key, skill, rate_limit_per_hour FROM triggers
       WHERE organization_id = '${organizationId}' AND event_type = '${eventType}' AND enabled = true`,
    )
    .catch(() => [])

  const started: { agent: string; runId: string }[] = []
  for (const t of triggers) {
    // Rate limit : nombre de runs déclenchés par ce trigger dans la dernière heure.
    const recent = await dbh
      .query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM agent_runs WHERE trigger_id = '${t.id}' AND created_at > now() - interval '1 hour'`)
      .catch(() => [{ cnt: '999' }])
    if (Number(recent[0]?.cnt ?? 0) >= t.rate_limit_per_hour) continue

    const workflowId = SKILL_WORKFLOW[t.skill]
    if (!workflowId) continue

    try {
      const result = await startAgentRun(dbh, {
        organizationId,
        agentKey: t.agent_key,
        workflowId,
        goal: `Déclenché par ${eventType}`,
        skill: t.skill,
        initiatorName,
        triggerId: t.id,
        inputData: payload,
      })
      started.push({ agent: t.agent_key, runId: result.run.id as string })
    } catch (err) {
      await audit(dbh, organizationId, {
        actorName: initiatorName,
        actorKind: 'system',
        action: 'trigger.failed',
        targetType: 'trigger',
        targetId: t.id,
        detail: { eventType, error: String(err).slice(0, 200) },
      }).catch(() => undefined)
    }
  }
  return started
}
