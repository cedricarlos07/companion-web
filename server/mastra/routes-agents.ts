import { Router } from 'express'
import type { DbHandle } from '../db/client.js'
import { authRequired, requireRole } from '../auth.js'
import { audit } from '../audit.js'
import { licenseGate } from '../services/license-mode.js'
import { startAgentRun, resumeAgentRun, rememberWorkflowId } from './runs.js'
import { dispatchEvent } from './triggers.js'
import { AGENT_SEEDS, primaryOrganizationId } from './seed-agents.js'

/** Routes de la couche agentique — branchées sur Mastra via la policy layer. */
export function buildAgentRouter(dbh: DbHandle): Router {
  const router = Router()

  /* ------------------------------- Agents -------------------------------- */

  router.get('/agents', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(
      `SELECT a.*, 
              (SELECT count(*) FROM agent_runs r WHERE r.agent_id = a.id)::int AS runs_total,
              (SELECT count(*) FROM agent_runs r WHERE r.agent_id = a.id AND r.status IN ('running','waiting_approval','waiting_input'))::int AS runs_active,
              (SELECT COALESCE(SUM(r.prompt_tokens + r.completion_tokens), 0) FROM agent_runs r WHERE r.agent_id = a.id)::int AS tokens_total
       FROM agents a WHERE a.organization_id = '${req.user!.organizationId}' ORDER BY a.created_at`,
    )
    res.json({ agents: rows })
  })

  router.get('/agents/:id', authRequired(dbh), async (req, res) => {
    const id = req.params.id as string
    const agent = (
      await dbh.query(`SELECT * FROM agents WHERE id = '${id}' AND organization_id = '${req.user!.organizationId}'`)
    )[0]
    if (!agent) return res.status(404).json({ error: 'agent introuvable' })
    const runs = await dbh.query(
      `SELECT id, goal, skill, status, prompt_tokens, completion_tokens, estimated_cost, verifier, created_at::text AS created_at
       FROM agent_runs WHERE agent_id = '${id}' ORDER BY created_at DESC LIMIT 15`,
    )
    res.json({ agent, runs })
  })

  router.post('/agents/:id/status', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { status } = req.body as { status: string }
    if (!['idle', 'running', 'paused'].includes(status)) return res.status(400).json({ error: 'statut invalide' })
    await dbh.exec(`UPDATE agents SET status = '${status}', updated_at = now() WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`)
    await audit(dbh, req.user!.organizationId, { actor: req.user, action: 'agent.status_changed', targetType: 'agent', targetId: String(req.params.id), detail: { status } })
    res.json({ ok: true })
  })

  /* -------------------------------- Runs ---------------------------------- */

  router.post('/agents/:id/runs', authRequired(dbh), requireRole('owner', 'admin', 'manager'), licenseGate(dbh), async (req, res) => {
    const { agentKey, workflowId, goal, skill, inputData } = req.body as {
      agentKey?: string; workflowId?: string; goal?: string; skill?: string; inputData?: Record<string, unknown>
    }
    const agentRow = (
      await dbh.query<{ key: string }>(`SELECT key FROM agents WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`)
    )[0]
    if (!agentRow) return res.status(404).json({ error: 'agent introuvable' })
    const seed = AGENT_SEEDS.find((a) => a.key === agentRow.key)
    if (seed && !seed.allowedSkills.includes(skill ?? '')) {
      return res.status(403).json({ error: `skill "${skill}" non autorisée pour cet agent` })
    }

    try {
      const result = await startAgentRun(dbh, {
        organizationId: req.user!.organizationId,
        agentKey: agentRow.key,
        workflowId: workflowId ?? '',
        goal: goal ?? `Exécution ${skill ?? 'workflow'}`,
        skill,
        initiatorUserId: req.user!.id,
        initiatorName: req.user!.name,
        inputData: inputData ?? {},
      })
      res.json(result)
    } catch (err) {
      res.status(500).json({ error: String(err).slice(0, 300) })
    }
  })

  router.get('/runs/:id', authRequired(dbh), async (req, res) => {
    const id = req.params.id as string
    const run = (await dbh.query(`SELECT * FROM agent_runs WHERE id = '${id}' AND organization_id = '${req.user!.organizationId}'`))[0]
    if (!run) return res.status(404).json({ error: 'run introuvable' })
    const steps = await dbh.query(`SELECT * FROM agent_run_steps WHERE run_id = '${id}' ORDER BY step_index`)
    const calls = await dbh.query(`SELECT tool, status, policy_decision, policy_reason, created_at::text AS created_at FROM tool_calls WHERE run_id = '${id}' ORDER BY created_at`)
    res.json({ run, steps, toolCalls: calls })
  })

  router.post('/runs/:id/feedback', authRequired(dbh), async (req, res) => {
    const { verdict, comment, correctionMemoryId } = req.body as { verdict?: string; comment?: string; correctionMemoryId?: string }
    if (!verdict || !['approve', 'correct', 'reject', 'rate'].includes(verdict)) {
      return res.status(400).json({ error: 'verdict invalide' })
    }
    await dbh.exec(
      `INSERT INTO agent_feedback (organization_id, run_id, user_id, user_name, verdict, comment, correction_memory_id)
       VALUES ('${req.user!.organizationId}', '${req.params.id}', '${req.user!.id}', '${req.user!.name.replace(/'/g, "''")}', '${verdict}',
               '${(comment ?? '').replace(/'/g, "''")}', ${correctionMemoryId ? `'${correctionMemoryId}'` : 'NULL'})`,
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'agent.feedback', targetType: 'agent_run', targetId: String(req.params.id), detail: { verdict },
    })
    res.json({ ok: true })
  })

  router.post('/runs/:id/resume', authRequired(dbh), requireRole('owner', 'admin', 'manager'), licenseGate(dbh), async (req, res) => {
    const { resumeData } = req.body as { resumeData?: Record<string, unknown> }
    try {
      const run = await resumeAgentRun(dbh, req.params.id as string, resumeData ?? {}, req.user!.name)
      res.json({ run })
    } catch (err) {
      res.status(500).json({ error: String(err).slice(0, 300) })
    }
  })

  /* ------------------------------ Approvals -------------------------------- */

  router.get('/approvals', authRequired(dbh), async (req, res) => {
    const status = (req.query.status as string) ?? 'pending'
    const where = status === 'all' ? 'TRUE' : `a.status = '${status.replace(/'/g, "''")}'`
    const rows = await dbh.query(
      `SELECT a.id, a.action, a.tool, a.risk_level, a.preview, a.reason, a.sources, a.status,
              a.requested_at::text AS requested_at, a.decided_at::text AS decided_at, a.decided_by,
              a.agent_name, a.run_id
       FROM approvals a WHERE a.organization_id = '${req.user!.organizationId}' AND ${where}
       ORDER BY a.requested_at DESC LIMIT 50`,
    )
    res.json({ approvals: rows })
  })

  router.post('/approvals/:id/approve', authRequired(dbh), requireRole('owner', 'admin', 'manager'), licenseGate(dbh), async (req, res) => {
    const approval = (
      await dbh.query<{ id: string; run_id: string | null; status: string }>(
        `SELECT id, run_id, status FROM approvals WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`,
      )
    )[0]
    if (!approval) return res.status(404).json({ error: 'approbation introuvable' })
    if (approval.status !== 'pending') return res.status(400).json({ error: 'déjà décidée' })
    await dbh.exec(
      `UPDATE approvals SET status = 'approved', decided_at = now(), decided_by = '${req.user!.name.replace(/'/g, "''")}' WHERE id = '${req.params.id}'`,
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'approval.granted', targetType: 'approval', targetId: String(req.params.id), detail: {},
    })
    if (approval.run_id) {
      // Reprise du workflow : le step suspendu lit la décision dans resumeData.
      const run = (await dbh.query<{ plan: { workflowId?: string; mastraRunId?: string } | null; goal: string }>(
        `SELECT plan, goal FROM agent_runs WHERE id = '${approval.run_id}'`,
      ))[0]
      if (run?.plan?.workflowId && run.plan.mastraRunId) {
        try {
          const { resumeAgentRun } = await import('./runs.js')
          const resumed = await resumeAgentRun(dbh, approval.run_id, { approved: true, decidedBy: req.user!.name }, req.user!.name)
          return res.json({ ok: true, run: resumed })
        } catch (err) {
          return res.status(500).json({ error: String(err).slice(0, 300) })
        }
      }
    }
    res.json({ ok: true })
  })

  router.post('/approvals/:id/reject', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const approval = (
      await dbh.query<{ id: string; run_id: string | null; status: string }>(
        `SELECT id, run_id, status FROM approvals WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`,
      )
    )[0]
    if (!approval) return res.status(404).json({ error: 'approbation introuvable' })
    if (approval.status !== 'pending') return res.status(400).json({ error: 'déjà décidée' })
    await dbh.exec(
      `UPDATE approvals SET status = 'rejected', decided_at = now(), decided_by = '${req.user!.name.replace(/'/g, "''")}' WHERE id = '${req.params.id}'`,
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'approval.rejected', targetType: 'approval', targetId: String(req.params.id), detail: {},
    })
    if (approval.run_id) {
      try {
        const { resumeAgentRun } = await import('./runs.js')
        await resumeAgentRun(dbh, approval.run_id, { approved: false, decidedBy: req.user!.name }, req.user!.name)
      } catch {
        // rejet sans reprise possible : le run reste en échec documenté
      }
    }
    res.json({ ok: true })
  })

  /* ------------------------------- Triggers -------------------------------- */

  router.get('/triggers', authRequired(dbh), async (req, res) => {
    const rows = await dbh.query(
      `SELECT id, event_type, agent_key, skill, enabled, rate_limit_per_hour FROM triggers WHERE organization_id = '${req.user!.organizationId}' ORDER BY event_type`,
    )
    res.json({ triggers: rows })
  })

  router.post('/triggers/:id/toggle', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    await dbh.exec(`UPDATE triggers SET enabled = NOT enabled WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`)
    res.json({ ok: true })
  })

  /* --------------------- Diagnostics policy (tests) ------------------------- */

  router.post('/agents/:id/policy-check', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { tool, input } = req.body as { tool?: string; input?: Record<string, unknown> }
    if (!tool) return res.status(400).json({ error: 'tool requis' })
    const { authorizeToolCall } = await import('./policy.js')
    const runId = `diag-${Date.now()}`
    try {
      await authorizeToolCall(
        { dbh, organizationId: req.user!.organizationId, agentId: req.params.id as string, runId, initiatorName: req.user!.name },
        tool,
        input ?? {},
      )
      res.json({ allowed: true })
    } catch (err) {
      res.json({ allowed: false, reason: String(err).slice(0, 200) })
    }
  })

  router.post('/agents/:id/limits', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const { maxRunTokens } = req.body as { maxRunTokens?: number }
    if (!maxRunTokens || maxRunTokens < 1) return res.status(400).json({ error: 'maxRunTokens invalide' })
    await dbh.exec(
      `UPDATE agents SET max_run_tokens = ${Math.floor(maxRunTokens)}, updated_at = now() WHERE id = '${req.params.id}' AND organization_id = '${req.user!.organizationId}'`,
    )
    res.json({ ok: true })
  })

  /* ---------------------------- Dispatch interne ---------------------------- */

  router.post('/events/:eventType', authRequired(dbh), async (req, res) => {
    const started = await dispatchEvent(dbh, req.user!.organizationId, req.params.eventType as string, (req.body ?? {}) as Record<string, unknown>, req.user!.name)
    res.json({ started })
  })

  return router
}

/** Seed agents au démarrage. */
export async function ensureAgentsSeeded(dbh: DbHandle) {
  const orgId = await primaryOrganizationId(dbh)
  if (orgId) {
    const { seedAgents } = await import('./seed-agents.js')
    await seedAgents(dbh, orgId)
  }
}

export { dispatchEvent, startAgentRun, rememberWorkflowId }
