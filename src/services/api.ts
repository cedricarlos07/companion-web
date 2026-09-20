/**
 * Companion API client.
 *
 * Chaque appel tente l'API réelle (backend Node sur /api, proxifié par Vite).
 * En cas d'indisponibilité, la fonction retourne `null` et la page garde ses
 * données de démonstration — aucun des 27 parcours ne casse, avec ou sans
 * backend. Les mappers convertissent les lignes SQL (snake_case) vers les
 * types du frontend (camelCase).
 */

import type {
  Employee, EmployeeStatus, Memory, MemoryStatus, KnowledgeType,
  Handover, Role,
} from '@/types'

export interface SessionUser {
  id: string
  email: string
  name: string
  app_role: string
  organization_id: string
  employee_id: string | null
  org_name?: string
  instance_url?: string | null
  sector?: string | null
  country?: string | null
}

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`/api${path}`, {
      method: init?.method ?? 'GET',
      credentials: 'include',
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
      body: init?.body,
    })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

/* ------------------------- Écritures (avec erreurs) ------------------------ */

/** Résultat d'une commande d'écriture : succès avec données, ou message
 *  d'erreur serveur à afficher (le corps { error } de l'API). */
export type CommandResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number }

async function command<T>(path: string, body: unknown, method = 'POST'): Promise<CommandResult<T>> {
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null
    if (!res.ok) return { ok: false, error: data?.error ?? `Erreur ${res.status}`, status: res.status }
    return { ok: true, data: (data ?? {}) as T }
  } catch {
    return { ok: false, error: 'Erreur réseau — la requête n\'a pas abouti.', status: 0 }
  }
}

/* ------------------------------ Agents (API) ------------------------------- */

/** Ligne agents telle que servie par l'API (snake_case). */
export interface AgentRow {
  id: string
  key: string
  name: string
  description: string | null
  goal: string
  status: string
  autonomy: string
  memory_scopes: string[]
  allowed_skills: string[]
  allowed_tools: string[]
  model_provider: string
  model: string | null
  max_run_tokens: number
  max_daily_tokens: number
  created_at: string
  updated_at: string
}

/** Ligne agents enrichie par GET /agents (compteurs de runs). */
export interface AgentListRow extends AgentRow {
  runs_total: number
  runs_active: number
  tokens_total: number
}

export interface AgentRunRow {
  id: string
  goal: string
  skill: string | null
  status: string
  prompt_tokens: number
  completion_tokens: number
  estimated_cost: string | number | null
  /** Objet JSONB { passed, score, reasons, retryable } écrit par runs.ts. */
  verifier: Record<string, unknown> | null
  created_at: string
}

export interface AgentTriggerRow {
  id: string
  event_type: string
  /** Présent sur GET /triggers (tous les triggers), absent sur GET /agents/:id. */
  agent_key?: string
  skill: string
  enabled: boolean
  rate_limit_per_hour: number
}

export interface AgentCatalog {
  skills: { id: string; workflow: string; label: string }[]
  tools: { id: string; label: string }[]
  memoryScopes: {
    global: { id: string; label: string }[]
    departments: { id: string; label: string }[]
    roles: { id: string; label: string }[]
  }
}

export interface AgentCreateInput {
  name: string
  description?: string
  goal: string
  autonomy: string
  memoryScopes?: string[]
  allowedSkills?: string[]
  allowedTools?: string[]
  maxRunTokens?: number
}

/* ------------------------------ Mappers ---------------------------------- */

export function mapEmployee(row: Record<string, unknown>): Employee {
  const status = String(row.status ?? 'active') as EmployeeStatus
  const unique = Number(row.unique_knowledge ?? 0)
  return {
    id: String(row.id),
    firstName: String(row.first_name ?? ''),
    lastName: String(row.last_name ?? ''),
    roleTitle: String(row.role_title ?? '—'),
    roleId: String(row.role_id ?? ''),
    department: String(row.department ?? '—'),
    email: String(row.email ?? ''),
    status,
    memories: Number(row.memories ?? 0),
    procedures: Number(row.procedures ?? 0),
    uniqueKnowledge: unique,
    coverage: Number(row.coverage ?? 0),
    risk: unique > 15 ? 'critical' : unique > 6 ? 'high' : unique > 2 ? 'moderate' : 'low',
    tenureYears: Math.floor(Number(row.seniority_months ?? 0) / 12),
    startDate: String(row.start_date ?? ''),
    companionAccess: 'full',
    lastActive: '—',
  }
}

export function mapMemory(row: Record<string, unknown>): Memory {
  return {
    id: String(row.id),
    type: String(row.type) as KnowledgeType,
    title: String(row.title),
    content: String(row.content ?? ''),
    scope: String(row.scope ?? ''),
    roleTitle: String(row.role_title ?? ''),
    ownerId: String(row.employee_id ?? ''),
    ownerName: String(row.employee_name ?? row.contributor ?? '—'),
    confidence: Number(row.confidence ?? 50),
    importance: Number(row.importance ?? 50),
    status: String(row.status) as MemoryStatus,
    updated: String(row.updated_at ?? ''),
    validFrom: String(row.valid_from ?? ''),
    evidence: [],
    history: [],
    related: [],
    contributor: String(row.contributor ?? ''),
    observedDate: String(row.created_at ?? ''),
    confirmations: Number(row.version ?? 1),
    humanValidated: Boolean(row.human_validated),
  }
}

export function mapHandover(row: Record<string, unknown>): Handover & { raw: Record<string, unknown> } {
  return {
    id: String(row.id),
    employeeId: String(row.employee_id ?? ''),
    employeeName: String(row.employee_name ?? ''),
    roleTitle: String(row.role_title ?? ''),
    status: String(row.status ?? 'analyzing') as Handover['status'],
    readiness: Number(row.readiness ?? 0),
    coverage: [],
    gaps: [],
    successorName: row.successor_name ? String(row.successor_name) : undefined,
    updatedAt: String(row.updated_at ?? ''),
    raw: row,
  }
}

/* ------------------------------ Endpoints --------------------------------- */

export const api = {
  /** Appel API brut typé — pour les écrans branchés progressivement. */
  async request<T = unknown>(path: string): Promise<T | null> {
    return call<T>(path)
  },

  async status() {
    return call<{ engine: string; ai: { available: boolean; llmModel: string; embedModel: string }; counts: { memories: number; employees: number; documents: number } }>('/status')
  },

  async login(email: string, password: string) {
    return call<{ user: SessionUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
  },

  async me() {
    return call<{ user: SessionUser }>('/auth/me')
  },

  async overview() {
    return call<{
      stats: { memories: number; employees: number; roles: number; documents: number; handovers: number }
      risk: { overall: number; level: string; criticalPeople: number; criticalRoles: number; topEmployees: { name: string; score: number; level: string }[] }
      recentMemories: Record<string, unknown>[]
      handovers: Record<string, unknown>[]
    }>('/overview')
  },

  async employees() {
    const res = await call<{ employees: Record<string, unknown>[] }>('/employees')
    return res ? res.employees.map(mapEmployee) : null
  },

  async employee(id: string) {
    return call<{
      employee: Record<string, unknown>
      memories: Record<string, unknown>[]
      uniqueKnowledge: Record<string, unknown>[]
      risk: { score: number; level: string; factors: { key: string; label: string; value: number; weight: number; detail: string }[]; stats: Record<string, number> } | null
    }>(`/employees/${id}`)
  },

  createEmployee(input: { firstName: string; lastName: string; email: string; roleId?: string }) {
    return command<{ employee: Record<string, unknown> }>('/employees', input)
  },

  async setEmployeeStatus(id: string, status: string) {
    return call<{ ok: boolean }>(`/employees/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    })
  },

  async roles() {
    const res = await call<{ roles: Record<string, unknown>[] }>('/roles')
    if (!res) return null
    return res.roles.map((r): Role => ({
      id: String(r.id),
      title: String(r.title),
      department: String(r.department ?? '—'),
      currentEmployees: Number(r.current_employees ?? 0),
      formerContributors: 0,
      memories: Number(r.memories ?? 0),
      procedures: Number(r.procedures ?? 0),
      decisions: Number(r.decisions ?? 0),
      contributors: Number(r.contributors ?? 0),
      lessons: 0,
      coverage: Number(r.coverage ?? 0),
      risk: Number(r.coverage ?? 0) >= 80 ? 'low' : Number(r.coverage ?? 0) >= 55 ? 'moderate' : 'critical',
      oblivionRisk: 100 - Number(r.coverage ?? 0),
      contributorTimeline: [],
    }))
  },

  async role(id: string) {
    return call<{
      role: Record<string, unknown>
      memories: Record<string, unknown>[]
      contributors: { name: string; contributions: number; from: string; to: string; employee_id: string | null }[]
      risk: { score: number; level: string; factors: { key: string; label: string; value: number; weight: number; detail: string }[] } | null
    }>(`/roles/${id}`)
  },

  async memories(filters: Record<string, string> = {}) {
    const params = new URLSearchParams(filters)
    const res = await call<{ memories: Record<string, unknown>[] }>(`/memories?${params}`)
    return res ? res.memories.map(mapMemory) : null
  },

  async memory(id: string) {
    return call<{
      memory: Record<string, unknown>
      evidence: { excerpt: string | null; location: string | null; document_title: string | null; document_id: string | null; mime_type: string | null }[]
      versions: { version: number; title: string; content: string; status: string; confidence: number; changed_by: string; change_reason: string; created_at: string }[]
      related: { id: string; title: string; type: string; kind: string }[]
    }>(`/memories/${id}`)
  },

  async verifyMemory(id: string) {
    return call<{ memory: Record<string, unknown> }>(`/memories/${id}/verify`, { method: 'POST' })
  },

  async setMemoryStatus(id: string, status: string, reason?: string) {
    return call<{ memory: Record<string, unknown> }>(`/memories/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    })
  },

  async promoteMemory(id: string, roleId: string) {
    return call<{ promoted: boolean }>(`/memories/${id}/promote`, {
      method: 'POST',
      body: JSON.stringify({ roleId }),
    })
  },

  async createMemory(input: Record<string, unknown>) {
    return call<{ memory: Record<string, unknown> }>('/memories', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  },

  async sources() {
    return call<{ sources: Record<string, unknown>[]; documents: Record<string, unknown>[] }>('/sources')
  },

  async uploadFiles(files: File[], options: { employeeId?: string; text?: string; title?: string; sourceName?: string } = {}) {
    const form = new FormData()
    for (const f of files) form.append('files', f)
    if (options.employeeId) form.append('employeeId', options.employeeId)
    if (options.text) form.append('text', options.text)
    if (options.title) form.append('title', options.title)
    form.append('sourceName', options.sourceName ?? 'Import manuel')
    try {
      const res = await fetch('/api/sources/upload', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) return null
      return (await res.json()) as {
        source: Record<string, unknown>
        documents: { id: string; title: string }[]
        results: { documentId: string; pagesApprox: number; chunksIndexed: number; memoriesCreated: number; confirmations: number; conflicts: number; engine: string }[]
      }
    } catch {
      return null
    }
  },

  async ask(question: string, filters: Record<string, string> = {}) {
    return call<{
      question: string
      answer: string
      abstained: boolean
      abstentionReason?: string
      citations: { index: number; memoryId: string; title: string; type: string; confidence: number; documentTitle?: string | null }[]
      memoriesUsed: { type: string; confidence: number }[]
      confidence: number
      engine: string
    }>('/ask', {
      method: 'POST',
      body: JSON.stringify({ question, ...filters }),
    })
  },

  async knowledgeRisk() {
    return call<{
      overall: number
      level: string
      criticalPeople: number
      criticalRoles: number
      singleOwnerProcedures: number
      employees: { subjectId: string; subjectName: string; score: number; level: string; factors: { key: string; label: string; value: number; weight: number; detail: string }[] }[]
      roles: { subjectId: string; subjectName: string; score: number; level: string }[]
    }>('/knowledge-risk')
  },

  async handovers() {
    const res = await call<{ handovers: Record<string, unknown>[] }>('/handovers')
    return res ? res.handovers.map(mapHandover) : null
  },

  async startHandover(employeeId: string) {
    return call<{ handover: { id: string }; gaps: number; uniqueKnowledge: number }>('/handovers', {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    })
  },

  async handover(id: string) {
    return call<{
      handover: Record<string, unknown>
      gaps: { id: string; kind: string; question: string; detail: string | null; status: string; answer_text: string | null; answered_by: string | null; produced_memory_id: string | null }[]
      uniqueKnowledge: { id: string; title: string; type: string; confidence: number }[]
    }>(`/handovers/${id}`)
  },

  async answerInterview(handoverId: string, gapId: string, answerText: string) {
    return call<{ memory: Record<string, unknown> | null }>(`/handovers/${handoverId}/answers`, {
      method: 'POST',
      body: JSON.stringify({ gapId, answerText }),
    })
  },

  async generatePack(handoverId: string) {
    return call<{ humanPack: Record<string, unknown>; machinePack: string }>(`/handovers/${handoverId}/pack`, { method: 'POST' })
  },

  async assignSuccessor(handoverId: string, employeeId: string) {
    return call<{ ok: boolean }>(`/handovers/${handoverId}/successor`, {
      method: 'POST',
      body: JSON.stringify({ employeeId }),
    })
  },

  async onboardings() {
    return call<{ onboardings: Record<string, unknown>[] }>('/onboardings')
  },

  async generateOnboarding(employeeId: string, handoverId?: string) {
    return call<{ onboarding: { id: string } }>('/onboardings', {
      method: 'POST',
      body: JSON.stringify({ employeeId, handoverId }),
    })
  },

  async onboarding(id: string) {
    return call<{ onboarding: Record<string, unknown> }>(`/onboardings/${id}`)
  },

  async audit(kind?: string) {
    const res = await call<{ events: Record<string, unknown>[] }>(`/audit${kind && kind !== 'all' ? `?kind=${kind}` : ''}`)
    return res?.events ?? null
  },

  /* -------------------------------- Agents --------------------------------- */

  async agents() {
    return call<{ agents: AgentListRow[] }>('/agents')
  },

  async agent(id: string) {
    return call<{
      agent: AgentRow
      runs: AgentRunRow[]
      usage: { runs_total: number; runs_active: number; tokens_total: number }
      triggers: AgentTriggerRow[]
    }>(`/agents/${id}`)
  },

  async agentCatalog() {
    return call<AgentCatalog>('/agents/catalog')
  },

  createAgent(input: AgentCreateInput) {
    return command<{ agent: AgentRow }>('/agents', input)
  },

  setAgentStatus(id: string, status: 'idle' | 'running' | 'paused') {
    return command<{ ok: boolean }>(`/agents/${id}/status`, { status })
  },

  setAgentLimits(id: string, maxRunTokens: number) {
    return command<{ ok: boolean }>(`/agents/${id}/limits`, { maxRunTokens })
  },

  startAgentRun(id: string, input: { skill: string; goal?: string; inputData?: Record<string, unknown> }) {
    return command<{ run?: { id: string }; mastraRunId?: string; status?: string }>(`/agents/${id}/runs`, input)
  },

  toggleTrigger(id: string) {
    return command<{ ok: boolean }>(`/triggers/${id}/toggle`, {})
  },

  /* ------------------------- Paramètres (config réelle) -------------------- */

  async triggers() {
    return call<{ triggers: AgentTriggerRow[] }>('/triggers')
  },

  async users() {
    return call<{ users: { id: string; email: string; name: string; app_role: string; active: boolean; last_active_at: string | null; employee_id: string | null }[] }>('/users')
  },

  async invitations() {
    return call<{ invitations: { id: string; email: string; role: string; status: string; expires_at: string; invited_by_name: string | null }[] }>('/invitations')
  },

  createInvitation(email: string, role: string) {
    return command<{ invitationId: string; devToken?: string }>('/invitations', { email, role })
  },

  updateOrganization(input: { name: string; sector?: string; country?: string }) {
    return command<{ organization: { name: string; sector: string | null; country: string | null } }>('/organizations/current', input)
  },

  async aiSettings() {
    return call<{ settings: { provider: string; chatModel: string; embedModel: string; embedDim: number } }>('/system/ai/settings')
  },

  setAiSettings(input: { chatModel?: string; embedModel?: string }) {
    return command<{ settings: { provider: string; chatModel: string; embedModel: string; embedDim: number } }>('/system/ai/settings', input)
  },

  async systemHealth() {
    return call<{
      engine: string
      provider: Record<string, unknown> & { ok?: boolean; provider?: string }
      ai: { ok: boolean; degraded: boolean; provider: string; chatModel: string; embedModel: string; availableModels: string[]; issues: string[] }
    }>('/system/memory-provider/health')
  },

  async securityCheck() {
    return call<{ ok: boolean; issues: string[]; checkedAt: string }>('/security/check')
  },

  async backups() {
    return call<{ backups: { dir: string; manifest: { version: string; createdAt: string; tables: Record<string, number>; uploadsCount: number } | null }[] }>('/backups')
  },

  createBackup() {
    return command<{ backupDir: string }>('/backup', {})
  },
}
