/* ------------------------------------------------------------------ *
 * Companion — domain types shared by every screen and mock data file. *
 * ------------------------------------------------------------------ */

export type KnowledgeType =
  | 'fact'
  | 'decision'
  | 'procedure'
  | 'relationship'
  | 'preference'
  | 'lesson'
  | 'project'
  | 'handover'

export type MemoryStatus =
  | 'candidate'
  | 'verified'
  | 'active'
  | 'conflicted'
  | 'contradicted'
  | 'deprecated'
  | 'archived'

export type RiskLevel = 'critical' | 'high' | 'moderate' | 'low' | 'healthy'

export type EmployeeStatus = 'active' | 'leaving' | 'onboarding' | 'former'

export type AgentRunState =
  | 'running'
  | 'thinking'
  | 'waiting'
  | 'waiting-approval'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'idle'

export type AutonomyLevel = 'assistant' | 'copilot' | 'autopilot'

export type SourceKind =
  | 'drive'
  | 'gmail'
  | 'm365'
  | 'notion'
  | 'slack'
  | 'whatsapp'
  | 'local'
  | 'crm'
  | 'erp'

export interface Evidence {
  id: string
  kind: 'email' | 'meeting' | 'crm' | 'document' | 'chat' | 'note'
  title: string
  date: string
  author: string
}

export interface HistoryEvent {
  id: string
  kind: 'created' | 'confirmed' | 'modified' | 'archived' | 'version'
  date: string
  actor: string
  detail?: string
}

export interface RelatedRef {
  id: string
  kind: 'memory' | 'person' | 'client' | 'role' | 'project'
  label: string
  meta?: string
  href?: string
}

export interface Memory {
  id: string
  type: KnowledgeType
  title: string
  content: string
  scope: string
  roleTitle: string
  ownerId: string
  ownerName: string
  confidence: number
  importance: number
  status: MemoryStatus
  updated: string
  validFrom: string
  evidence: Evidence[]
  history: HistoryEvent[]
  related: RelatedRef[]
  /** Provenance */
  contributor: string
  observedDate: string
  confirmations: number
  humanValidated: boolean
}

export interface Employee {
  id: string
  firstName: string
  lastName: string
  roleTitle: string
  roleId: string
  department: string
  email: string
  status: EmployeeStatus
  memories: number
  procedures: number
  uniqueKnowledge: number
  coverage: number
  risk: RiskLevel
  tenureYears: number
  startDate: string
  companionAccess: 'full' | 'limited' | 'none'
  lastActive: string
}

export interface Contributor {
  name: string
  from: string
  to: string
  contributions: number
  employeeId?: string
}

export interface Role {
  id: string
  title: string
  department: string
  currentEmployees: number
  formerContributors: number
  memories: number
  procedures: number
  decisions: number
  contributors: number
  lessons: number
  coverage: number
  risk: RiskLevel
  /** Risk d'oubli (0-100) as ranked on the Knowledge Risk screen. */
  oblivionRisk: number
  contributorTimeline: Contributor[]
}

export interface SourceConnection {
  id: string
  kind: SourceKind
  name: string
  status: 'connected' | 'disconnected' | 'available' | 'error'
  detail: string
  files?: number
  lastSync?: string
}

export interface IngestionRecord {
  id: string
  sourceName: string
  type: string
  ownerName: string
  imported: string
  memoriesExtracted: number
  status: 'complete' | 'processing' | 'failed' | 'partial'
}

export interface MemoryAccessRule {
  scope: string
  kind: 'company' | 'department' | 'role' | 'role-brain' | 'person'
  allowed: boolean
}

export interface ActionPermission {
  action: string
  mode: 'automatic' | 'approval' | 'blocked'
}

export interface AgentActivityEntry {
  id: string
  time: string
  detail: string
  kind: 'knowledge' | 'handover' | 'onboarding' | 'sales' | 'operations'
}

export interface Agent {
  id: string
  name: string
  description: string
  goal: string
  status: AgentRunState
  autonomy: AutonomyLevel
  lastActivity: string
  skills: string[]
  tools: string[]
  memoryAccess: MemoryAccessRule[]
  permissions: ActionPermission[]
  recent: AgentActivityEntry[]
}

export interface CoverageItem {
  label: string
  value: number
}

export interface KnowledgeGap {
  id: string
  question: string
  kind: 'missing' | 'conflict'
  detail: string
  cta: 'interview' | 'resolve'
}

export interface Handover {
  id: string
  employeeId: string
  employeeName: string
  roleTitle: string
  status: 'analyzing' | 'in-progress' | 'interview' | 'ready'
  readiness: number
  coverage: CoverageItem[]
  gaps: KnowledgeGap[]
  successorName?: string
  updatedAt: string
}

export interface InterviewQuestion {
  id: string
  prompt: string
  answer?: string
  producedMemory?: { type: KnowledgeType; title: string; confidence: number }
}

export interface OnboardingSection {
  id: string
  title: string
  detail: string
  icon: 'role' | 'customers' | 'procedures' | 'projects' | 'people' | 'decisions' | 'tasks' | 'check' | 'ask'
  items: string[]
  done: boolean
}

export interface Onboarding {
  id: string
  employeeName: string
  roleTitle: string
  startDate: string
  readiness: number
  progress: number
  builtFrom: string[]
  sections: OnboardingSection[]
}

export interface Approval {
  id: string
  agentName: string
  agentId: string
  kind: 'action' | 'memory-update'
  title: string
  reason: string
  sources: number
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  emailPreview?: { to: string; subject: string; body: string }
  memoryChange?: { label: string; from: string; to: string; evidence: string }
}

export interface Automation {
  id: string
  event: string
  condition?: string
  action: string
  agentName: string
  status: 'active' | 'paused'
  runs: number
  lastRun: string
}

export type ActivityKind =
  | 'agents'
  | 'users'
  | 'knowledge'
  | 'sources'
  | 'security'
  | 'approvals'

export interface ActivityEvent {
  id: string
  time: string
  actor: string
  actorKind: 'agent' | 'user' | 'admin'
  action: string
  detail: string
  kind: ActivityKind
  origin: 'human' | 'agent' | 'suggested' | 'autonomous' | 'approval' | 'verified'
}

export interface AppNotification {
  id: string
  category: 'attention' | 'agents' | 'knowledge' | 'security'
  title: string
  detail?: string
  time: string
  read: boolean
  href?: string
}

export type IntegrationCategory =
  | 'communication'
  | 'knowledge'
  | 'business'
  | 'ai'
  | 'protocol'

export interface Integration {
  id: string
  category: IntegrationCategory
  name: string
  description: string
  status: 'connected' | 'disconnected' | 'available'
  cta: string
}

export interface McpTool {
  name: string
  description: string
}

export interface Client {
  id: string
  name: string
  industry: string
  ownerName: string
  contacts: number
  memories: number
  health: RiskLevel
}

export interface Project {
  id: string
  name: string
  clientName?: string
  status: 'active' | 'at-risk' | 'closing'
  ownerName: string
  members: string[]
  updated: string
}

export interface Organization {
  workspace: string
  sector: string
  country: string
  memories: number
  employees: number
  rolesCount: number
  coverage: number
  criticalRisks: number
  activeAgents: number
  pendingApprovals: number
  health: {
    score: number
    documented: number
    verified: number
    upToDate: number
    shared: number
  }
  instance: string
  currentUser: string
  currentUserRole: string
}
