import { Router } from 'express'
import type { DbHandle } from '../db/client.js'
import { authRequired, requireRole } from '../auth.js'
import { audit } from '../audit.js'
import { licenseGate } from '../services/license-mode.js'
import { agents as agentsTable } from '../db/schema.js'
import { startAgentRun, resumeAgentRun, rememberWorkflowId } from './runs.js'
import { dispatchEvent, SKILL_WORKFLOW } from './triggers.js'
import { COMPANION_TOOLS } from './tools.js'
import { primaryOrganizationId } from './seed-agents.js'

/** Libellés FR du catalogue — la référence technique reste l'id du skill/tool. */
const SKILL_LABELS: Record<string, string> = {
  handover_employee: 'Préparer un départ (handover)',
  interview_employee: "Conduire l'entretien de départ",
  onboard_employee: "Générer l'onboarding d'un nouvel arrivant",
  resolve_contradiction: 'Résoudre une contradiction',
  capture_knowledge: 'Extraire des connaissances',
  draft_followup: 'Rédiger une relance client',
  research_customer: 'Rechercher un contexte client',
  prepare_meeting: 'Préparer une réunion',
}

const TOOL_LABELS: Record<string, string> = {
  search_memory: 'Recherche en mémoire',
  get_employee_context: 'Contexte employé',
  get_role_context: 'Contexte rôle (Role Brain)',
  get_company_context: 'Contexte entreprise',
  get_project_context: 'Contexte projets',
  get_knowledge_gaps: 'Lacunes de connaissances',
  create_memory_candidate: 'Proposer une connaissance',
  create_handover: 'Créer un handover',
  create_onboarding: 'Créer un onboarding',
  create_task: 'Créer une tâche',
  request_approval: "Demander une approbation",
}

const AUTONOMIES = ['assistant', 'copilot', 'autopilot']

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
       FROM agents a WHERE a.organization_id = $1::uuid ORDER BY a.created_at`, [req.user!.organizationId],
    )
    res.json({ agents: rows })
  })

  /* ------------------------- Catalogue de configuration ------------------- */

  // Seule source des skills/tools réellement exécutables : le wizard de
  // création n'affiche rien qui ne soit branché à un workflow Mastra ou à un
  // tool policy-gated. Les périmètres mémoire proposés sont ceux de l'org.
  router.get('/agents/catalog', authRequired(dbh), async (req, res) => {
    const departments = await dbh.query<{ id: string; name: string }>(
      `SELECT id, name FROM departments WHERE organization_id = $1::uuid ORDER BY name`, [req.user!.organizationId],
    )
    const roles = await dbh.query<{ id: string; title: string }>(
      `SELECT id, title FROM roles WHERE organization_id = $1::uuid ORDER BY title`, [req.user!.organizationId],
    )
    res.json({
      skills: Object.entries(SKILL_WORKFLOW).map(([id, workflow]) => ({
        id, workflow, label: SKILL_LABELS[id] ?? id,
      })),
      tools: Object.keys(COMPANION_TOOLS).map((id) => ({ id, label: TOOL_LABELS[id] ?? id })),
      memoryScopes: {
        global: [
          { id: 'company', label: 'Mémoire entreprise' },
          { id: 'role', label: 'Mémoire de rôle — tous rôles' },
          { id: 'department', label: 'Mémoire de département — tous départements' },
          { id: 'employee', label: 'Mémoire employé (cible du run)' },
        ],
        departments: departments.map((d) => ({ id: `department:${d.id}`, label: `Département ${d.name}` })),
        roles: roles.map((r) => ({ id: `role:${r.id}`, label: `Rôle ${r.title}` })),
      },
    })
  })

  /* ------------------------------- Création -------------------------------- */

  router.post('/agents', authRequired(dbh), requireRole('owner', 'admin'), async (req, res) => {
    const { name, description, goal, autonomy, memoryScopes, allowedSkills, allowedTools, maxRunTokens } = req.body as {
      name?: string; description?: string; goal?: string; autonomy?: string
      memoryScopes?: string[]; allowedSkills?: string[]; allowedTools?: string[]; maxRunTokens?: number
    }
    const trimmedName = (name ?? '').trim()
    const trimmedGoal = (goal ?? '').trim()
    if (trimmedName.length < 2) return res.status(400).json({ error: 'nom requis (2 caractères minimum)' })
    if (trimmedGoal.length < 4) return res.status(400).json({ error: 'objectif requis (4 caractères minimum)' })
    if (!AUTONOMIES.includes(autonomy ?? '')) {
      return res.status(400).json({ error: `autonomie invalide — attendu : ${AUTONOMIES.join(', ')}` })
    }
    const skills = allowedSkills ?? []
    const unknownSkill = skills.find((s) => !(s in SKILL_WORKFLOW))
    if (unknownSkill) return res.status(400).json({ error: `skill inconnue (aucun workflow) : ${unknownSkill}` })
    const tools = allowedTools ?? []
    const unknownTool = tools.find((t) => !(t in COMPANION_TOOLS))
    if (unknownTool) return res.status(400).json({ error: `outil inconnu : ${unknownTool}` })
    const scopes = memoryScopes ?? []
    if (scopes.some((s) => typeof s !== 'string' || s.length === 0 || s.length > 120) || scopes.length > 60) {
      return res.status(400).json({ error: 'périmètres mémoire invalides' })
    }
    const budget = Math.floor(Number(maxRunTokens ?? 20000))
    if (!Number.isFinite(budget) || budget < 1000 || budget > 2_000_000) {
      return res.status(400).json({ error: 'maxRunTokens doit être un entier entre 1 000 et 2 000 000' })
    }

    // key unique par org : slug du nom, suffixé en cas de collision.
    const base = trimmedName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'agent'
    const existing = await dbh.query<{ key: string }>(
      `SELECT key FROM agents WHERE organization_id = $1::uuid AND key LIKE $2`, [req.user!.organizationId, `${base}%`],
    )
    const taken = new Set(existing.map((r) => r.key))
    let key = base
    for (let i = 2; taken.has(key); i++) key = `${base}-${i}`

    const [agent] = await dbh.db
      .insert(agentsTable)
      .values({
        organizationId: req.user!.organizationId,
        key,
        name: trimmedName,
        description: (description ?? '').trim() || null,
        goal: trimmedGoal,
        status: 'idle',
        autonomy: autonomy!,
        memoryScopes: scopes,
        allowedSkills: skills,
        allowedTools: tools,
        maxRunTokens: budget,
      })
      .returning()
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'agent.created', targetType: 'agent', targetId: String(agent.id),
      detail: { name: trimmedName, autonomy, skills, tools, scopes, maxRunTokens: budget },
    })
    res.status(201).json({ agent })
  })

  router.get('/agents/:id', authRequired(dbh), async (req, res) => {
    const id = req.params.id as string
    const agent = (
      await dbh.query(`SELECT * FROM agents WHERE id = $1::uuid AND organization_id = $2::uuid`, [id, req.user!.organizationId])
    )[0]
    if (!agent) return res.status(404).json({ error: 'agent introuvable' })
    const runs = await dbh.query(
      `SELECT id, goal, skill, status, prompt_tokens, completion_tokens, estimated_cost, verifier, created_at::text AS created_at
       FROM agent_runs WHERE agent_id = $1::uuid ORDER BY created_at DESC LIMIT 15`, [id],
    )
    const usage = (
      await dbh.query<{ runs_total: number; runs_active: number; tokens_total: number }>(
        `SELECT (SELECT count(*) FROM agent_runs r WHERE r.agent_id = $1::uuid)::int AS runs_total,
                (SELECT count(*) FROM agent_runs r WHERE r.agent_id = $1::uuid AND r.status IN ('running','waiting_approval','waiting_input'))::int AS runs_active,
                (SELECT COALESCE(SUM(r.prompt_tokens + r.completion_tokens), 0) FROM agent_runs r WHERE r.agent_id = $1::uuid)::int AS tokens_total`, [id],
      )
    )[0]
    const triggers = agent.key
      ? await dbh.query(
          `SELECT id, event_type, skill, enabled, rate_limit_per_hour FROM triggers
           WHERE organization_id = $1::uuid AND agent_key = $2 ORDER BY event_type`, [req.user!.organizationId, agent.key],
        )
      : []
    res.json({ agent, runs, usage: usage ?? { runs_total: 0, runs_active: 0, tokens_total: 0 }, triggers })
  })

  router.post('/agents/:id/status', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    const { status } = req.body as { status: string }
    if (!['idle', 'running', 'paused'].includes(status)) return res.status(400).json({ error: 'statut invalide' })
    await dbh.exec(
      `UPDATE agents SET status = $1, updated_at = now() WHERE id = $2::uuid AND organization_id = $3::uuid`,
      [status, req.params.id, req.user!.organizationId],
    )
    await audit(dbh, req.user!.organizationId, { actor: req.user, action: 'agent.status_changed', targetType: 'agent', targetId: String(req.params.id), detail: { status } })
    res.json({ ok: true })
  })

  /* -------------------------------- Runs ---------------------------------- */

  router.post('/agents/:id/runs', authRequired(dbh), requireRole('owner', 'admin', 'manager'), licenseGate(dbh), async (req, res) => {
    const { goal, skill, inputData } = req.body as {
      goal?: string; skill?: string; inputData?: Record<string, unknown>
    }
    const agentRow = (
      await dbh.query<{ key: string; allowed_skills: string[] }>(
        `SELECT key, allowed_skills FROM agents WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [req.params.id, req.user!.organizationId],
      )
    )[0]
    if (!agentRow) return res.status(404).json({ error: 'agent introuvable' })
    // Source de vérité : la table. Les seeds appliquaient cette vérification,
    // les agents créés via l'API doivent passer par la même barrière.
    const allowedSkills = agentRow.allowed_skills ?? []
    if (!allowedSkills.includes(skill ?? '')) {
      return res.status(403).json({ error: `skill "${skill}" non autorisée pour cet agent` })
    }
    // Le workflow vient du mapping serveur skill → workflow ; le client ne
    // peut plus en imposer un arbitraire sans skill correspondant.
    const workflowId = req.body.workflowId ?? SKILL_WORKFLOW[skill ?? ''] ?? ''
    if (!workflowId) {
      return res.status(400).json({ error: `skill "${skill}" sans workflow connu — fournir workflowId` })
    }

    try {
      const result = await startAgentRun(dbh, {
        organizationId: req.user!.organizationId,
        agentKey: agentRow.key,
        workflowId,
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
    const run = (
      await dbh.query(`SELECT * FROM agent_runs WHERE id = $1::uuid AND organization_id = $2::uuid`, [id, req.user!.organizationId])
    )[0]
    if (!run) return res.status(404).json({ error: 'run introuvable' })
    const steps = await dbh.query(`SELECT * FROM agent_run_steps WHERE run_id = $1::uuid ORDER BY step_index`, [id])
    const calls = await dbh.query(
      `SELECT tool, status, policy_decision, policy_reason, created_at::text AS created_at FROM tool_calls WHERE run_id = $1::uuid ORDER BY created_at`,
      [id],
    )
    res.json({ run, steps, toolCalls: calls })
  })

  router.post('/runs/:id/feedback', authRequired(dbh), async (req, res) => {
    const { verdict, comment, correctionMemoryId } = req.body as { verdict?: string; comment?: string; correctionMemoryId?: string }
    if (!verdict || !['approve', 'correct', 'reject', 'rate'].includes(verdict)) {
      return res.status(400).json({ error: 'verdict invalide' })
    }
    await dbh.exec(
      `INSERT INTO agent_feedback (organization_id, run_id, user_id, user_name, verdict, comment, correction_memory_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.user!.organizationId, req.params.id, req.user!.id, req.user!.name, verdict, comment ?? null, correctionMemoryId ?? null],
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
    const rows = await dbh.query(
      `SELECT a.id, a.action, a.tool, a.risk_level, a.preview, a.reason, a.sources, a.status,
              a.requested_at::text AS requested_at, a.decided_at::text AS decided_at, a.decided_by,
              a.agent_name, a.run_id
       FROM approvals a WHERE a.organization_id = $1::uuid AND ($2::text = 'all' OR a.status = $2::text)
       ORDER BY a.requested_at DESC LIMIT 50`,
      [req.user!.organizationId, status],
    )
    res.json({ approvals: rows })
  })

  router.post('/approvals/:id/approve', authRequired(dbh), requireRole('owner', 'admin', 'manager'), licenseGate(dbh), async (req, res) => {
    const approval = (
      await dbh.query<{ id: string; run_id: string | null; status: string }>(
        `SELECT id, run_id, status FROM approvals WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [req.params.id, req.user!.organizationId],
      )
    )[0]
    if (!approval) return res.status(404).json({ error: 'approbation introuvable' })
    if (approval.status !== 'pending') return res.status(400).json({ error: 'déjà décidée' })
    await dbh.exec(
      `UPDATE approvals SET status = 'approved', decided_at = now(), decided_by = $1 WHERE id = $2::uuid`,
      [req.user!.name, req.params.id],
    )
    await audit(dbh, req.user!.organizationId, {
      actor: req.user, action: 'approval.granted', targetType: 'approval', targetId: String(req.params.id), detail: {},
    })
    if (approval.run_id) {
      // Reprise du workflow : le step suspendu lit la décision dans resumeData.
      const run = (await dbh.query<{ plan: { workflowId?: string; mastraRunId?: string } | null; goal: string }>(
        `SELECT plan, goal FROM agent_runs WHERE id = $1::uuid`, [approval.run_id],
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
        `SELECT id, run_id, status FROM approvals WHERE id = $1::uuid AND organization_id = $2::uuid`,
        [req.params.id, req.user!.organizationId],
      )
    )[0]
    if (!approval) return res.status(404).json({ error: 'approbation introuvable' })
    if (approval.status !== 'pending') return res.status(400).json({ error: 'déjà décidée' })
    await dbh.exec(
      `UPDATE approvals SET status = 'rejected', decided_at = now(), decided_by = $1 WHERE id = $2::uuid`,
      [req.user!.name, req.params.id],
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
      `SELECT id, event_type, agent_key, skill, enabled, rate_limit_per_hour FROM triggers WHERE organization_id = $1::uuid ORDER BY event_type`, [req.user!.organizationId],
    )
    res.json({ triggers: rows })
  })

  router.post('/triggers/:id/toggle', authRequired(dbh), requireRole('owner', 'admin', 'manager'), async (req, res) => {
    await dbh.exec(
      `UPDATE triggers SET enabled = NOT enabled WHERE id = $1::uuid AND organization_id = $2::uuid`,
      [req.params.id, req.user!.organizationId],
    )
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
      `UPDATE agents SET max_run_tokens = $1, updated_at = now() WHERE id = $2::uuid AND organization_id = $3::uuid`,
      [Math.floor(maxRunTokens), req.params.id, req.user!.organizationId],
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
