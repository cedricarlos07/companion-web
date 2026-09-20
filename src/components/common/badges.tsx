import { cx } from '@/utils/cx'
import { Chip } from '@/components/base/badges/chip'
import type { AgentRunState, AutonomyLevel, KnowledgeType, MemoryStatus, RiskLevel } from '@/types'
import {
  Exchange01Icon,
  FileValidationIcon,
  GavelIcon,
  HandshakeIcon,
  Idea01Icon,
  Folder01Icon,
  InformationCircleIcon,
  StarIcon,
} from '@/lib/icons'
import { HugeIcon } from '@/components/ui/huge-icon'

/* ------------------------- Knowledge type badge -------------------------- */

const TYPE_META: Record<
  KnowledgeType,
  { label: string; color: 'blue' | 'purple' | 'cyan' | 'lime' | 'yellow' | 'rose' | 'gray' | 'neutral' }
> = {
  fact: { label: 'Fait', color: 'blue' },
  decision: { label: 'Décision', color: 'purple' },
  procedure: { label: 'Procédure', color: 'cyan' },
  relationship: { label: 'Relation', color: 'lime' },
  preference: { label: 'Préférence', color: 'yellow' },
  lesson: { label: 'Leçon', color: 'rose' },
  project: { label: 'Projet', color: 'gray' },
  handover: { label: 'Handover', color: 'neutral' },
}

export function knowledgeTypeMeta(t: KnowledgeType) {
  return TYPE_META[t]
}

export function KnowledgeTypeBadge({ type }: { type: KnowledgeType }) {
  const meta = TYPE_META[type]
  return (
    <Chip variant="caption" color={meta.color}>
      {meta.label}
    </Chip>
  )
}

export const KNOWLEDGE_TYPE_ICONS: Record<KnowledgeType, typeof FileValidationIcon> = {
  fact: InformationCircleIcon,
  decision: GavelIcon,
  procedure: FileValidationIcon,
  relationship: HandshakeIcon,
  preference: StarIcon,
  lesson: Idea01Icon,
  project: Folder01Icon,
  handover: Exchange01Icon,
}

export function KnowledgeTypeIcon({ type, size = 'sm', className }: { type: KnowledgeType; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  return <HugeIcon icon={KNOWLEDGE_TYPE_ICONS[type]} size={size} className={className} />
}

/* ------------------------- Memory status badge --------------------------- */

const STATUS_META: Record<
  MemoryStatus,
  { label: string; color: 'lime' | 'yellow' | 'rose' | 'blue' | 'neutral' | 'gray' }
> = {
  candidate: { label: 'Candidate', color: 'yellow' },
  verified: { label: 'Vérifiée', color: 'lime' },
  active: { label: 'Active', color: 'blue' },
  conflicted: { label: 'En conflit', color: 'rose' },
  contradicted: { label: 'Contradictoire', color: 'rose' },
  deprecated: { label: 'Obsolète', color: 'neutral' },
  archived: { label: 'Archivée', color: 'gray' },
}

export function KnowledgeStatusBadge({ status }: { status: MemoryStatus }) {
  const meta = STATUS_META[status]
  return (
    <Chip variant="caption" color={meta.color}>
      {meta.label}
    </Chip>
  )
}

export function memoryStatusMeta(s: MemoryStatus) {
  // Défensif : un statut serveur inconnu ne doit jamais crasher le rendu.
  return STATUS_META[s] ?? { label: String(s), color: 'neutral' as const }
}

/* ---------------------------- Risk badges -------------------------------- */

const RISK_META: Record<RiskLevel, { label: string; color: 'rose' | 'yellow' | 'lime' | 'neutral' }> = {
  critical: { label: 'Critique', color: 'rose' },
  high: { label: 'Élevé', color: 'rose' },
  moderate: { label: 'Modéré', color: 'yellow' },
  low: { label: 'Faible', color: 'lime' },
  healthy: { label: 'Sain', color: 'lime' },
}

export function RiskBadge({ risk, label }: { risk: RiskLevel; label?: string }) {
  const meta = RISK_META[risk]
  return (
    <Chip variant="caption" color={meta.color}>
      {label ?? meta.label}
    </Chip>
  )
}

export function CriticalBadge() {
  return (
    <Chip variant="bold" color="rose">
      CRITIQUE
    </Chip>
  )
}

/* --------------------------- Confidence badge ---------------------------- */

export function ConfidenceBadge({ value }: { value: number }) {
  const level =
    value >= 85 ? { label: 'Confiance élevée', color: 'lime' as const }
    : value >= 65 ? { label: 'Confiance modérée', color: 'yellow' as const }
    : { label: 'Confiance limitée', color: 'rose' as const }
  return (
    <span className="inline-flex items-center gap-1.5">
      <Chip variant="caption" color={level.color}>
        {level.label}
      </Chip>
      <span className="text-caption-1-medium text-text-tertiary">{value} %</span>
    </span>
  )
}

/* --------------------------- Agent status badge --------------------------- */

const AGENT_STATE_META: Record<AgentRunState, { label: string; color: 'lime' | 'yellow' | 'rose' | 'neutral' | 'blue' }> = {
  running: { label: 'En cours', color: 'lime' },
  thinking: { label: 'Réflexion', color: 'blue' },
  waiting: { label: 'En attente', color: 'yellow' },
  'waiting-approval': { label: 'Validation requise', color: 'yellow' },
  completed: { label: 'Terminé', color: 'lime' },
  failed: { label: 'Échec', color: 'rose' },
  paused: { label: 'En pause', color: 'neutral' },
  idle: { label: 'Inactif', color: 'neutral' },
}

export function AgentStatusBadge({ status }: { status: AgentRunState }) {
  const meta = AGENT_STATE_META[status]
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cx(
          'size-1.5 rounded-full',
          status === 'running' || status === 'thinking'
            ? 'animate-pulse bg-emerald-500'
            : status === 'failed'
              ? 'bg-rose-500'
              : status === 'paused' || status === 'idle'
                ? 'bg-neutral-400'
                : 'bg-amber-500',
        )}
        aria-hidden
      />
      <Chip variant="caption" color={meta.color}>
        {meta.label}
      </Chip>
    </span>
  )
}

export function agentStateLabel(s: AgentRunState): string {
  return AGENT_STATE_META[s].label
}

/* ---------------------------- Autonomy badge ------------------------------ */

const AUTONOMY_META: Record<AutonomyLevel, { label: string; color: 'neutral' | 'blue' | 'purple' }> = {
  assistant: { label: 'Assistant', color: 'neutral' },
  copilot: { label: 'Copilote', color: 'blue' },
  autopilot: { label: 'Pilote auto', color: 'purple' },
}

export function AutonomyBadge({ autonomy }: { autonomy: AutonomyLevel }) {
  const meta = AUTONOMY_META[autonomy]
  return (
    <Chip variant="caption" color={meta.color}>
      {meta.label}
    </Chip>
  )
}

export function autonomyDescription(a: AutonomyLevel): string {
  return a === 'assistant'
    ? 'Recommande des actions mais ne les exécute pas.'
    : a === 'copilot'
      ? 'Prépare des actions et demande une validation lorsque nécessaire.'
      : 'Exécute les actions pré-autorisées dans les limites définies.'
}

/* ------------------------------- Role badge ------------------------------- */

export function RoleBadge({ title }: { title: string }) {
  return (
    <Chip variant="caption" color="gray">
      {title}
    </Chip>
  )
}

/** Percentage text with semantic color, used in tables and risk lists. */
export function RiskPercent({ value, level }: { value: number; level: 'critical' | 'high' | 'moderate' | 'low' | 'healthy' }) {
  const color =
    level === 'critical' || level === 'high'
      ? 'text-text-primary'
      : level === 'moderate'
        ? 'text-text-primary'
        : 'text-text-secondary'
  return <span className={cx('text-body-semibold tabular-nums', color)}>{value} %</span>
}
