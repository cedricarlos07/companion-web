import type { DbHandle } from '../db/client.js'

/**
 * Seed des 4 agents V1 — allowlists explicites, deny par défaut.
 * Un agent ne peut jamais modifier ses propres permissions : aucune API
 * n'expose les allowlists, seule la table est source de vérité (admin SQL).
 */

export const AGENT_SEEDS = [
  {
    key: 'knowledge-agent',
    name: 'Knowledge Agent',
    description: 'Analyse les nouvelles sources, détecte les contradictions et les lacunes, propose des mémoires candidates.',
    goal: 'Analyser les sources et proposer des connaissances fiables — jamais auto-validées.',
    autonomy: 'assistant',
    memoryScopes: ['*'],
    allowedSkills: ['capture_knowledge', 'resolve_contradiction', 'detect_knowledge_gap'],
    allowedTools: ['search_memory', 'get_company_context', 'get_employee_context', 'get_role_context', 'get_knowledge_gaps', 'create_memory_candidate', 'create_task'],
  },
  {
    key: 'handover-agent',
    name: 'Handover Agent',
    description: 'Orchestre les départs : analyse Employee Memory vs Role Brain, lacunes, entretien, pack.',
    goal: 'Garantir la continuité de chaque poste avant un départ.',
    autonomy: 'copilot',
    memoryScopes: ['company', 'role', 'department', 'employee'],
    allowedSkills: ['handover_employee', 'interview_employee', 'detect_knowledge_gap'],
    allowedTools: ['search_memory', 'get_employee_context', 'get_role_context', 'get_knowledge_gaps', 'create_handover', 'create_memory_candidate'],
  },
  {
    key: 'onboarding-agent',
    name: 'Onboarding Agent',
    description: 'Génère les parcours J1/J7/J30 depuis Role Brain + Handover + projets actifs.',
    goal: 'Rendre chaque nouvel employé opérationnel depuis la mémoire du rôle.',
    autonomy: 'copilot',
    memoryScopes: ['company', 'role', 'department'],
    allowedSkills: ['onboard_employee'],
    allowedTools: ['search_memory', 'get_role_context', 'get_employee_context', 'create_onboarding'],
  },
  {
    key: 'company-assistant',
    name: 'Company Assistant',
    description: 'Répond avec sources, prépare les actions (relances, réunions) — envoi toujours soumis à approbation.',
    goal: 'Assister les équipes avec la mémoire validée, sans jamais agir sans approbation.',
    autonomy: 'copilot',
    memoryScopes: ['company', 'role:Responsable Commercial', 'department:Commercial'],
    allowedSkills: ['research_customer', 'prepare_meeting', 'draft_followup'],
    allowedTools: ['search_memory', 'get_company_context', 'get_role_context', 'get_project_context', 'create_task', 'request_approval'],
  },
]

export async function seedAgents(dbh: DbHandle, organizationId: string) {
  for (const a of AGENT_SEEDS) {
    await dbh.exec(
      `INSERT INTO agents (organization_id, key, name, description, goal, status, autonomy, memory_scopes, allowed_skills, allowed_tools, model_provider, model)
       VALUES ($1, $2, $3, $4, $5, 'idle', $6, $7::jsonb, $8::jsonb, $9::jsonb, 'ollama', NULL)
       ON CONFLICT (organization_id, key) DO NOTHING`,
      [organizationId, a.key, a.name, a.description, a.goal, a.autonomy,
       JSON.stringify(a.memoryScopes), JSON.stringify(a.allowedSkills), JSON.stringify(a.allowedTools)],
    )
  }

  // Triggers V1 — les 5 événements du plan.
  // Anti-storm : quota réel en production (20/h), quota large sinon — les
  // batteries de tests relancent les mêmes événements et épuiseraient 20/h.
  const triggerRateLimit = Number(
    process.env.TRIGGER_RATE_LIMIT_PER_HOUR ??
      (process.env.NODE_ENV === 'production' ? 20 : 500),
  )
  const triggerSeeds = [
    { eventType: 'employee.leaving', agentKey: 'handover-agent', skill: 'handover_employee' },
    { eventType: 'employee.created', agentKey: 'onboarding-agent', skill: 'onboard_employee' },
    { eventType: 'memory.contradicted', agentKey: 'knowledge-agent', skill: 'resolve_contradiction' },
    { eventType: 'knowledge_risk.high', agentKey: 'knowledge-agent', skill: 'capture_knowledge' },
    { eventType: 'source.ingested', agentKey: 'knowledge-agent', skill: 'capture_knowledge' },
  ]
  for (const t of triggerSeeds) {
    await dbh.exec(
      `INSERT INTO triggers (organization_id, event_type, agent_key, skill, rate_limit_per_hour)
       SELECT $1, $2, $3, $4, $5
       WHERE NOT EXISTS (
         SELECT 1 FROM triggers WHERE organization_id = $6::uuid AND event_type = $7
       )`, [organizationId, t.eventType, t.agentKey, t.skill, triggerRateLimit, organizationId, t.eventType],
    )
  }
}

/** Récupère l'organisation principale (dev mono-org). */
export async function primaryOrganizationId(dbh: DbHandle): Promise<string | null> {
  const rows = await dbh.query<{ id: string }>(`SELECT id FROM organizations ORDER BY created_at LIMIT 1`)
  return rows[0]?.id ?? null
}
