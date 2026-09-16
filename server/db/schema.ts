import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  real,
  uuid,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { vector } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

/* ------------------------------------------------------------------ *
 * Companion — real database schema (Drizzle / PostgreSQL + pgvector)  *
 * ------------------------------------------------------------------ */

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  sector: text('sector'),
  country: text('country'),
  instanceUrl: text('instance_url'),
  settings: jsonb('settings').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
}, (t) => [uniqueIndex('departments_org_name_uq').on(t.organizationId, t.name)])

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  departmentId: uuid('department_id').references(() => departments.id),
  title: text('title').notNull(),
  description: text('description'),
  coverageTarget: integer('coverage_target').default(90).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('roles_org_idx').on(t.organizationId)])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  /** owner | admin | manager | employee | auditor | agent */
  appRole: text('app_role').default('employee').notNull(),
  employeeId: uuid('employee_id'),
  active: boolean('active').default(true).notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const employees = pgTable('employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  roleId: uuid('role_id').references(() => roles.id),
  departmentId: uuid('department_id').references(() => departments.id),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  email: text('email').notNull().unique(),
  /** active | leaving | onboarding | former */
  status: text('status').default('active').notNull(),
  startDate: text('start_date'),
  seniorityMonths: integer('seniority_months').default(0).notNull(),
  companionAccess: text('companion_access').default('full').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('employees_org_idx').on(t.organizationId), index('employees_status_idx').on(t.status)])

export const sources = pgTable('sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  /** local | drive | gmail | m365 | notion | slack | whatsapp | crm | erp | paste */
  kind: text('kind').default('local').notNull(),
  name: text('name').notNull(),
  status: text('status').default('connected').notNull(),
  config: jsonb('config').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  sourceId: uuid('source_id').references(() => sources.id),
  uploadedById: uuid('uploaded_by_id').references(() => users.id),
  title: text('title').notNull(),
  /** pdf | docx | txt | md | csv | paste */
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').default(0).notNull(),
  /** original text preserved — the source of truth for provenance */
  rawText: text('raw_text'),
  storagePath: text('storage_path'),
  /** queued | extracting | embedding | extracting_memories | done | failed */
  status: text('status').default('queued').notNull(),
  statusDetail: text('status_detail'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('documents_org_idx').on(t.organizationId), index('documents_status_idx').on(t.status)])

export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
  embeddingProvider: text('embedding_provider'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('chunks_doc_idx').on(t.documentId)])

export const memories = pgTable('memories', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  /** fact | decision | procedure | relationship | preference | lesson | project | handover */
  type: text('type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  /** employee | role | department | company | restricted */
  scope: text('scope').default('company').notNull(),
  employeeId: uuid('employee_id').references(() => employees.id),
  roleId: uuid('role_id').references(() => roles.id),
  departmentId: uuid('department_id').references(() => departments.id),
  /** candidate | verified | active | contradicted | superseded | deprecated | rejected */
  status: text('status').default('candidate').notNull(),
  confidence: integer('confidence').default(50).notNull(),
  importance: integer('importance').default(50).notNull(),
  validFrom: text('valid_from'),
  validUntil: text('valid_until'),
  /** who contributed this knowledge (person or agent name) */
  contributor: text('contributor'),
  /** extraction engine: llm | heuristic | human | interview */
  origin: text('origin').default('human').notNull(),
  /** true when a human confirmed the memory */
  humanValidated: boolean('human_validated').default(false).notNull(),
  version: integer('version').default(1).notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
  embeddingProvider: text('embedding_provider'),
  supersedesId: uuid('supersedes_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [
  index('memories_org_idx').on(t.organizationId),
  index('memories_type_idx').on(t.type),
  index('memories_status_idx').on(t.status),
  index('memories_employee_idx').on(t.employeeId),
  index('memories_role_idx').on(t.roleId),
])

export const memorySources = pgTable('memory_sources', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryId: uuid('memory_id').notNull().references(() => memories.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id').references(() => documents.id),
  chunkId: uuid('chunk_id').references(() => chunks.id, { onDelete: 'cascade' }),
  /** excerpt of the source this memory came from */
  excerpt: text('excerpt'),
  location: text('location'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('memory_sources_memory_idx').on(t.memoryId)])

export const memoryLinks = pgTable('memory_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  fromMemoryId: uuid('from_memory_id').notNull().references(() => memories.id, { onDelete: 'cascade' }),
  toMemoryId: uuid('to_memory_id').notNull().references(() => memories.id, { onDelete: 'cascade' }),
  /** related | contradicts | supersedes | supports */
  kind: text('kind').default('related').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('memory_links_from_idx').on(t.fromMemoryId)])

export const memoryVersions = pgTable('memory_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  memoryId: uuid('memory_id').notNull().references(() => memories.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  status: text('status').notNull(),
  confidence: integer('confidence').notNull(),
  importance: integer('importance').notNull(),
  changedBy: text('changed_by'),
  changeReason: text('change_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('memory_versions_memory_idx').on(t.memoryId)])

export const feedback = pgTable('feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  /** ask | memory | handover | onboarding */
  targetType: text('target_type').notNull(),
  targetId: uuid('target_id'),
  /** helpful | wrong | incomplete */
  verdict: text('verdict').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const handovers = pgTable('handovers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  roleId: uuid('role_id').references(() => roles.id),
  successorEmployeeId: uuid('successor_employee_id').references(() => employees.id),
  /** analyzing | gaps | interview | ready */
  status: text('status').default('analyzing').notNull(),
  readiness: integer('readiness').default(0).notNull(),
  analysis: jsonb('analysis').default({}).notNull(),
  humanPack: jsonb('human_pack'),
  machinePack: text('machine_pack'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('handovers_employee_idx').on(t.employeeId)])

export const handoverGaps = pgTable('handover_gaps', {
  id: uuid('id').primaryKey().defaultRandom(),
  handoverId: uuid('handover_id').notNull().references(() => handovers.id, { onDelete: 'cascade' }),
  /** missing_procedure | conflict | undocumented_task | single_owner_relation | decision_context */
  kind: text('kind').notNull(),
  question: text('question').notNull(),
  detail: text('detail'),
  /** open | answered | resolved */
  status: text('status').default('open').notNull(),
  relatedMemoryId: uuid('related_memory_id').references(() => memories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const handoverAnswers = pgTable('handover_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  gapId: uuid('gap_id').notNull().references(() => handoverGaps.id, { onDelete: 'cascade' }),
  handoverId: uuid('handover_id').notNull().references(() => handovers.id, { onDelete: 'cascade' }),
  answerText: text('answer_text').notNull(),
  answeredBy: text('answered_by'),
  producedMemoryId: uuid('produced_memory_id').references(() => memories.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const onboardings = pgTable('onboardings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  employeeId: uuid('employee_id').notNull().references(() => employees.id),
  roleId: uuid('role_id').references(() => roles.id),
  handoverId: uuid('handover_id').references(() => handovers.id),
  plan: jsonb('plan').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  actorId: uuid('actor_id').references(() => users.id),
  actorName: text('actor_name'),
  /** human | agent | system */
  actorKind: text('actor_kind').default('human').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type'),
  targetId: text('target_id'),
  detail: jsonb('detail').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => [index('audit_org_time_idx').on(t.organizationId, t.createdAt)])

/** Interview questions attached to a handover gap */
export const interviewQuestions = pgTable('interview_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  handoverId: uuid('handover_id').notNull().references(() => handovers.id, { onDelete: 'cascade' }),
  gapId: uuid('gap_id').references(() => handoverGaps.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const NOW = sql`now()`

/* ------------------------ Phase 2 : Agent Orchestrator ------------------- */

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  goal: text('goal').notNull(),
  status: text('status').default('idle').notNull(),
  /** assistant | copilot | autopilot_limited */
  autonomy: text('autonomy').default('copilot').notNull(),
  memoryScopes: jsonb('memory_scopes').default([]).notNull(),
  allowedSkills: jsonb('allowed_skills').default([]).notNull(),
  allowedTools: jsonb('allowed_tools').default([]).notNull(),
  modelProvider: text('model_provider').default('ollama').notNull(),
  model: text('model'),
  maxRunTokens: integer('max_run_tokens').default(20000).notNull(),
  maxDailyTokens: integer('max_daily_tokens').default(200000).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const agentRuns = pgTable('agent_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  agentId: uuid('agent_id').notNull().references(() => agents.id),
  initiatorUserId: uuid('initiator_user_id').references(() => users.id),
  initiatorName: text('initiator_name'),
  triggerId: uuid('trigger_id'),
  goal: text('goal').notNull(),
  skill: text('skill'),
  plan: jsonb('plan'),
  status: text('status').default('queued').notNull(),
  memoriesUsed: jsonb('memories_used').default([]).notNull(),
  sourcesUsed: jsonb('sources_used').default([]).notNull(),
  result: jsonb('result'),
  verifier: jsonb('verifier'),
  model: text('model'),
  promptTokens: integer('prompt_tokens').default(0).notNull(),
  completionTokens: integer('completion_tokens').default(0).notNull(),
  estimatedCost: real('estimated_cost').default(0).notNull(),
  latencyMs: integer('latency_ms'),
  errors: jsonb('errors').default([]).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const agentRunSteps = pgTable('agent_run_steps', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
  stepIndex: integer('step_index').notNull(),
  description: text('description').notNull(),
  skill: text('skill'),
  tools: jsonb('tools').default([]).notNull(),
  status: text('status').default('pending').notNull(),
  output: jsonb('output'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().defaultRandom(),
  runId: uuid('run_id').references(() => agentRuns.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id),
  tool: text('tool').notNull(),
  input: jsonb('input').default({}).notNull(),
  outputSummary: jsonb('output_summary'),
  status: text('status').default('ok').notNull(),
  policyDecision: text('policy_decision').default('allowed').notNull(),
  policyReason: text('policy_reason'),
  promptTokens: integer('prompt_tokens').default(0).notNull(),
  completionTokens: integer('completion_tokens').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  runId: uuid('run_id').references(() => agentRuns.id),
  agentId: uuid('agent_id').references(() => agents.id),
  agentName: text('agent_name'),
  action: text('action').notNull(),
  tool: text('tool').notNull(),
  riskLevel: text('risk_level').default('medium').notNull(),
  preview: jsonb('preview').default({}).notNull(),
  reason: text('reason'),
  sources: jsonb('sources').default([]).notNull(),
  status: text('status').default('pending').notNull(),
  requestedAt: timestamp('requested_at', { withTimezone: true }).defaultNow().notNull(),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  decidedBy: text('decided_by'),
})

export const triggers = pgTable('triggers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  eventType: text('event_type').notNull(),
  conditions: jsonb('conditions').default({}).notNull(),
  agentKey: text('agent_key').notNull(),
  skill: text('skill').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  rateLimitPerHour: integer('rate_limit_per_hour').default(20).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const agentFeedback = pgTable('agent_feedback', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  runId: uuid('run_id').references(() => agentRuns.id),
  userId: uuid('user_id').references(() => users.id),
  userName: text('user_name'),
  verdict: text('verdict').notNull(),
  comment: text('comment'),
  correctionMemoryId: uuid('correction_memory_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const settings = pgTable('settings', {
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  key: text('key').notNull(),
  value: jsonb('value').default({}).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
