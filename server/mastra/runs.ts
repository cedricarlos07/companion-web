import { randomUUID } from 'node:crypto'
import type { DbHandle } from '../db/client.js'
import { audit } from '../audit.js'
import { getMastra } from './index.js'
import { registerRunContext, type RunContext } from './run-context.js'

/**
 * Liaison Mastra ↔ Companion : démarrage des workflows, statuts des runs,
 * reprise après approbation, feedback. Chaque run Mastra est lié à une
 * ligne agent_runs (goal, status, tokens, coût, verifier).
 */

export interface StartRunOptions {
  organizationId: string
  agentKey: string
  workflowId: string
  goal: string
  skill?: string
  initiatorUserId?: string | null
  initiatorName?: string
  inputData: Record<string, unknown>
  triggerId?: string
}

export async function startAgentRun(dbh: DbHandle, opts: StartRunOptions) {
  const agentRows = await dbh.query<{ id: string; name: string; status: string; model: string | null }>(
    `SELECT id, name, status, model FROM agents WHERE organization_id = $1::uuid AND key = $2`, [opts.organizationId, opts.agentKey],
  )
  const agent = agentRows[0]
  if (!agent) throw new Error(`agent introuvable: ${opts.agentKey}`)

  const runId = randomUUID()
  await dbh.exec(
    `INSERT INTO agent_runs (id, organization_id, agent_id, initiator_user_id, initiator_name, trigger_id, goal, skill, status, model)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'running', $9)`,
    [runId, opts.organizationId, agent.id, opts.initiatorUserId ?? null, opts.initiatorName ?? 'utilisateur',
     opts.triggerId ?? null, opts.goal, opts.skill ?? null, agent.model ?? null],
  )

  registerRunContext({
    dbh,
    organizationId: opts.organizationId,
    agentId: agent.id,
    runId,
    initiatorName: opts.initiatorName,
  })

  const mastra = getMastra()
  const workflow = mastra.getWorkflow(opts.workflowId)
  const run = await workflow.createRun({ runId: `mr-${runId}` })

  // Liaison bidirectionnelle Companion ↔ Mastra.
  await rememberWorkflowId(dbh, runId, opts.workflowId, run.runId)

  const startPromise = run.start({ inputData: { ...opts.inputData, runId } })

  // Statut final/suspendu — best-effort, ne bloque pas la réponse API si lent.
  const settled = await Promise.race([
    startPromise.then((r) => ({ kind: 'done' as const, result: r })),
    new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), 120000)),
  ])

  let status = 'completed'
  let resultJson: unknown = null

  if (settled.kind === 'done') {
    const r = settled.result
    const runStatus = (r as { status?: string }).status ?? 'completed'
    const payloadStr = JSON.stringify((r as { payload?: unknown }).payload ?? '{}')
    let suspendedStepId = ''
    if (runStatus === 'suspended') {
      // Statut déterministe : une approval pending pour ce run = validation requise.
      const pending = await dbh.query<{ cnt: string }>(
        `SELECT count(*)::text AS cnt FROM approvals WHERE run_id = $1::uuid AND status = 'pending'`, [runId],
      )
      status = Number(pending[0]?.cnt ?? 0) > 0 ? 'waiting_approval' : 'waiting_input'
      // Identifie le step suspendu pour le resume.
      const steps = (r as { steps?: Record<string, { status?: string }> }).steps ?? {}
      for (const [stepId, info] of Object.entries(steps)) {
        if (info.status === 'suspended') suspendedStepId = stepId
      }
      if (suspendedStepId) {
        await dbh.exec(
          `UPDATE agent_runs SET plan = jsonb_set(COALESCE(plan, '{}'::jsonb), '{suspendedStepId}', to_jsonb($1::text)) WHERE id = $2::uuid`,
          [suspendedStepId, runId],
        )
      }
    } else if (runStatus === 'failed') {
      status = 'failed'
    }
    resultJson = (r as { result?: unknown }).result ?? null

    // Timeline synthétique persistée (best-effort).
    const steps = (r as { steps?: Record<string, { status?: string }> }).steps ?? {}
    let idx = 0
    for (const [stepId, info] of Object.entries(steps)) {
      idx++
      await dbh.exec(
        `INSERT INTO agent_run_steps (run_id, step_index, description, status, output)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [runId, idx, stepId, info.status ?? 'success', JSON.stringify(info).slice(0, 4000)],
      ).catch(() => undefined)
    }

    // Verifier simple : réussite + présence de résultat.
    const verifier = {
      passed: runStatus === 'completed',
      score: runStatus === 'completed' ? 1 : 0,
      reasons: runStatus === 'completed' ? ['workflow terminé'] : ['workflow en échec ou suspendu'],
      retryable: false,
    }
    await dbh.exec(
      `UPDATE agent_runs SET status = $1, result = $2::jsonb,
        verifier = $3::jsonb, latency_ms = 0
       WHERE id = $4::uuid`,
      [status, JSON.stringify(resultJson ?? {}).slice(0, 100000), JSON.stringify(verifier), runId],
    )
  } else {
    // Timeout : le workflow continue en arrière-plan (suspendu ou long) — statut lu via l'API.
    status = 'running'
    await dbh.exec(`UPDATE agent_runs SET status = 'running' WHERE id = $1::uuid`, [runId])
  }

  await audit(dbh, opts.organizationId, {
    actorName: opts.initiatorName ?? 'agent',
    actorKind: 'agent',
    action: 'agent.run_started',
    targetType: 'agent_run',
    targetId: runId,
    detail: { agent: opts.agentKey, workflow: opts.workflowId, goal: opts.goal.slice(0, 200) },
  })

  const final = await dbh.query(`SELECT * FROM agent_runs WHERE id = $1::uuid`, [runId])
  return { run: final[0], mastraRunId: run.runId, status }
}

/** Reprise d'un run suspendu après décision humaine. */
export async function resumeAgentRun(dbh: DbHandle, runId: string, resumeData: Record<string, unknown>, decidedBy: string) {
  const rows = await dbh.query<{ organization_id: string; plan: { mastraRunId?: string } | null; goal: string }>(
    `SELECT organization_id, plan, goal FROM agent_runs WHERE id = $1::uuid`, [runId],
  )
  const row = rows[0]
  if (!row) throw new Error('run introuvable')
  const mastraRunId = row.plan?.mastraRunId
  if (!mastraRunId) throw new Error('run Mastra non lié')

  const mastra = getMastra()
  // Le workflow id est dérivé du run suspendu : on passe par tous les workflows
  // pour retrouver le run (Mastra n'expose pas de getRun global en 1.x — on
  // mémorise le workflow id dans le plan lors du démarrage).
  const workflowId = row.plan?.mastraRunId ? (row.plan as { workflowId?: string }).workflowId : undefined
  if (!workflowId) throw new Error('workflow id non mémorisé pour ce run')

  const workflow = mastra.getWorkflow(workflowId)
  const run = await workflow.createRun({ runId: mastraRunId })
  const planRows = await dbh.query<{ plan: { suspendedStepId?: string } | null }>(`SELECT plan FROM agent_runs WHERE id = $1::uuid`, [runId])
  const stepId = planRows[0]?.plan?.suspendedStepId
  const result = await run.resume({
    resumeData: { ...resumeData, decidedBy },
    ...(stepId ? { step: stepId } : {}),
  })

  const runStatus = (result as { status?: string }).status ?? 'completed'
  const newStatus = runStatus === 'suspended' ? 'waiting_approval' : runStatus === 'failed' ? 'failed' : 'completed'
  await dbh.exec(
    `UPDATE agent_runs SET status = $1, updated_at = now() WHERE id = $2::uuid`, [newStatus, runId],
  )
  await audit(dbh, row.organization_id, {
    actorName: decidedBy,
    action: 'agent.run_resumed',
    targetType: 'agent_run',
    targetId: runId,
    detail: { decision: resumeData.approved === false ? 'rejected' : 'approved', status: newStatus },
  })
  const final = await dbh.query(`SELECT * FROM agent_runs WHERE id = $1::uuid`, [runId])
  return final[0]
}

/** Workflow id + mastra run id mémorisés au démarrage (utilisés par resume). */
export async function rememberWorkflowId(dbh: DbHandle, runId: string, workflowId: string, mastraRunId: string) {
  await dbh.exec(
    `UPDATE agent_runs SET plan = jsonb_set(jsonb_set(COALESCE(plan, '{}'::jsonb), '{workflowId}', to_jsonb($1::text)), '{mastraRunId}', to_jsonb($2::text))
     WHERE id = $3::uuid`, [workflowId, mastraRunId, runId],
  )
}
