import type { DbHandle } from '../db/client.js'
import { runCompanionQuery } from './companion-queries.js'

/**
 * Registry de tools Companion pour Mastra.
 *
 * Chaque tool appelle un service métier existant — JAMAIS de SQL direct.
 * Le policy gate (`authorizeToolCall`) est exécuté dans les workflows
 * avant chaque tool, et chaque tool journalise son appel.
 */

export interface ToolContext {
  dbh: DbHandle
  organizationId: string
  agentId: string
  runId: string
  initiatorName?: string
}

export interface ToolDefinition<I = unknown, O = unknown> {
  name: string
  description: string
  riskLevel: 'low' | 'medium' | 'high'
  externalSideEffect: boolean
  requiresApproval?: (input: I) => boolean
  execute: (ctx: ToolContext, input: I) => Promise<O>
}

/* ----------------------------- Implémentations ---------------------------- */

export const searchMemoryTool: ToolDefinition<{ query: string; topK?: number }, { results: { id: string; title: string; type: string; score: number }[] }> = {
  name: 'search_memory',
  description: 'Recherche sémantique dans la mémoire de l organisation (Company Brain).',
  riskLevel: 'low',
  externalSideEffect: false,
  // @ts-expect-error schemas câblés à l enregistrement Mastra
  inputSchema: undefined,
  execute: async (ctx, input) => {
    const { getMemoryProvider } = await import('../memory/index.js')
    const provider = await getMemoryProvider(ctx.dbh, ctx.organizationId)
    const hits = await provider.search({ query: input.query, organizationId: ctx.organizationId, topK: input.topK ?? 8 })
    if (hits.length === 0) return { results: [] }
    const ids = hits.map((h) => `'${h.companionMemoryId}'`).join(',')
    const rows = await runCompanionQuery<{ id: string; title: string; type: string; scope: string; status: string }>(
      ctx.dbh,
      `SELECT id, title, type, scope, status FROM memories WHERE id IN (${ids}) AND status NOT IN ('rejected','superseded')`,
    )
    const scoreById = new Map(hits.map((h) => [h.companionMemoryId, h.score]))
    return {
      results: rows.map((r) => ({
        id: r.id,
        title: r.title,
        type: r.type,
        score: scoreById.get(r.id) ?? 0,
      })),
    }
  },
}

export const getEmployeeContextTool: ToolDefinition<{ employeeId: string }, { name: string; role: string | null; memories: { title: string; type: string }[]; riskScore: number | null }> = {
  name: 'get_employee_context',
  description: "Contexte opérationnel d'un employé : mémoires, connaissances uniques, risque.",
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const emp = await runCompanionQuery<{ first_name: string; last_name: string; role_title: string | null }>(
      ctx.dbh,
      `SELECT e.first_name, e.last_name, r.title AS role_title FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.id = '${input.employeeId}' AND e.organization_id = '${ctx.organizationId}'`,
    )
    if (!emp[0]) throw new Error('employé introuvable')
    const mems = await runCompanionQuery<{ title: string; type: string }>(
      ctx.dbh,
      `SELECT title, type FROM memories WHERE employee_id = '${input.employeeId}' AND status NOT IN ('rejected','superseded') ORDER BY importance DESC LIMIT 10`,
    )
    const risk = await runCompanionQuery<{ score: number | null }>(
      ctx.dbh,
      `SELECT (SELECT readiness FROM handovers WHERE employee_id = '${input.employeeId}' ORDER BY created_at DESC LIMIT 1) AS score`,
    )
    return {
      name: `${emp[0].first_name} ${emp[0].last_name}`,
      role: emp[0].role_title,
      memories: mems,
      riskScore: risk[0]?.score ?? null,
    }
  },
}

export const getRoleContextTool: ToolDefinition<{ roleId: string }, { title: string | null; memories: { title: string; type: string }[] }> = {
  name: 'get_role_context',
  description: 'Contexte agrégé du Role Brain : procédures, décisions, leçons du rôle.',
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const role = await runCompanionQuery<{ title: string | null }>(ctx.dbh, `SELECT title FROM roles WHERE id = '${input.roleId}'`)
    const mems = await runCompanionQuery<{ title: string; type: string }>(
      ctx.dbh,
      `SELECT title, type FROM memories WHERE role_id = '${input.roleId}' AND status IN ('active','verified') ORDER BY importance DESC LIMIT 12`,
    )
    return { title: role[0]?.title ?? null, memories: mems }
  },
}

export const getCompanyContextTool: ToolDefinition<Record<string, never>, { memories: number; employees: number; roles: number }> = {
  name: 'get_company_context',
  description: "Vue d'ensemble de la mémoire de l'organisation.",
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx) => {
    const rows = await runCompanionQuery<{ memories: string; employees: string; roles: string }>(
      ctx.dbh,
      `SELECT (SELECT count(*) FROM memories WHERE organization_id = '${ctx.organizationId}')::text AS memories,
              (SELECT count(*) FROM employees WHERE organization_id = '${ctx.organizationId}' AND status <> 'former')::text AS employees,
              (SELECT count(*) FROM roles WHERE organization_id = '${ctx.organizationId}')::text AS roles`,
    )
    return {
      memories: Number(rows[0]?.memories ?? 0),
      employees: Number(rows[0]?.employees ?? 0),
      roles: Number(rows[0]?.roles ?? 0),
    }
  },
}

export const getProjectContextTool: ToolDefinition<{ query: string }, { projects: { id: string; title: string }[] }> = {
  name: 'get_project_context',
  description: 'Mémoires de type projet correspondant à une recherche.',
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const rows = await runCompanionQuery<{ id: string; title: string }>(
      ctx.dbh,
      `SELECT id, title FROM memories WHERE organization_id = '${ctx.organizationId}' AND type = 'project' AND title ILIKE '%${input.query.replace(/'/g, "''")}%' AND status NOT IN ('rejected','superseded') LIMIT 8`,
    )
    return { projects: rows }
  },
}

export const getKnowledgeGapsTool: ToolDefinition<{ handoverId: string }, { gaps: { id: string; question: string; status: string }[] }> = {
  name: 'get_knowledge_gaps',
  description: 'Lacunes de connaissance détectées sur un handover.',
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const gaps = await runCompanionQuery<{ id: string; question: string; status: string }>(
      ctx.dbh,
      `SELECT id, question, status FROM handover_gaps WHERE handover_id = '${input.handoverId}' ORDER BY created_at`,
    )
    return { gaps }
  },
}

export const createMemoryCandidateTool: ToolDefinition<{ type: string; title: string; content: string; employeeId?: string; roleId?: string }, { memoryId: string; created: boolean }> = {
  name: 'create_memory_candidate',
  description: 'Crée une memory candidate (jamais active sans validation humaine).',
  riskLevel: 'medium',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const { createMemory } = await import('../services/memory.js')
    const result = await createMemory(ctx.dbh, {
      organizationId: ctx.organizationId,
      type: input.type as never,
      title: input.title,
      content: input.content,
      scope: input.roleId ? 'role' : 'employee',
      employeeId: input.employeeId ?? null,
      roleId: input.roleId ?? null,
      confidence: 70,
      importance: 70,
      status: 'candidate',
      contributor: 'agent',
      origin: 'llm',
      changedBy: 'agent',
    })
    return { memoryId: result.memory?.id ?? '', created: result.created }
  },
}

export const createHandoverTool: ToolDefinition<{ employeeId: string }, { handoverId: string; gaps: number }> = {
  name: 'create_handover',
  description: 'Analyse le poste et crée le handover avec gaps et questions.',
  riskLevel: 'medium',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const { startHandover } = await import('../services/handover.js')
    const result = await startHandover(ctx.dbh, ctx.organizationId, input.employeeId, ctx.initiatorName ?? 'agent')
    return { handoverId: result.handover.id, gaps: result.gaps }
  },
}

export const createOnboardingTool: ToolDefinition<{ employeeId: string; handoverId?: string }, { onboardingId: string; sections: number }> = {
  name: 'create_onboarding',
  description: 'Génère le parcours J1/J7/J30 depuis Role Brain + Handover.',
  riskLevel: 'medium',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const { generateOnboarding } = await import('../services/onboarding.js')
    const created = await generateOnboarding(ctx.dbh, ctx.organizationId, input.employeeId, input.handoverId ?? null, ctx.initiatorName ?? 'agent')
    const plan = created.plan as { sections?: unknown[] }
    return { onboardingId: created.id, sections: plan.sections?.length ?? 0 }
  },
}

export const createTaskTool: ToolDefinition<{ title: string; detail?: string }, { memoryId: string }> = {
  name: 'create_task',
  description: 'Crée une tâche traçable (mémoire candidate dédiée + audit).',
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const { createMemory } = await import('../services/memory.js')
    const result = await createMemory(ctx.dbh, {
      organizationId: ctx.organizationId,
      type: 'preference',
      title: `Tâche : ${input.title}`,
      content: input.detail ?? input.title,
      scope: 'company',
      confidence: 90,
      importance: 60,
      status: 'candidate',
      contributor: 'agent',
      origin: 'llm',
      changedBy: 'agent',
    })
    return { memoryId: result.memory?.id ?? '' }
  },
}

export const requestApprovalTool: ToolDefinition<{ action: string; tool: string; riskLevel?: string; reason: string; preview: Record<string, unknown> }, { approvalId: string }> = {
  name: 'request_approval',
  description: "Demande une validation humaine avant une action sensible.",
  riskLevel: 'low',
  externalSideEffect: false,
  execute: async (ctx, input) => {
    const agent = await runCompanionQuery<{ name: string }>(ctx.dbh, `SELECT name FROM agents WHERE id = '${ctx.agentId}'`)
    const rows = await runCompanionQuery<{ id: string }>(
      ctx.dbh,
      `INSERT INTO approvals (organization_id, run_id, agent_id, agent_name, action, tool, risk_level, preview, reason, status)
       VALUES ('${ctx.organizationId}', '${ctx.runId}', '${ctx.agentId}', '${(agent[0]?.name ?? 'Agent').replace(/'/g, "''")}',
               '${input.action.replace(/'/g, "''")}', '${input.tool.replace(/'/g, "''")}', '${input.riskLevel ?? 'medium'}',
               '${JSON.stringify(input.preview).replace(/'/g, "''")}'::jsonb, '${(input.reason ?? '').replace(/'/g, "''")}', 'pending')
       RETURNING id`,
    )
    return { approvalId: rows[0].id }
  },
}

/* ------------------------------ Registre ---------------------------------- */

export const COMPANION_TOOLS = {
  search_memory: searchMemoryTool,
  get_employee_context: getEmployeeContextTool,
  get_role_context: getRoleContextTool,
  get_company_context: getCompanyContextTool,
  get_project_context: getProjectContextTool,
  get_knowledge_gaps: getKnowledgeGapsTool,
  create_memory_candidate: createMemoryCandidateTool,
  create_handover: createHandoverTool,
  create_onboarding: createOnboardingTool,
  create_task: createTaskTool,
  request_approval: requestApprovalTool,
} as const

export type CompanionToolName = keyof typeof COMPANION_TOOLS
