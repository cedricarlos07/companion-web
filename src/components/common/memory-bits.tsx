import type { Evidence, KnowledgeType, Memory } from '@/types'
import { cx } from '@/utils/cx'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  ChatBotIcon,
  Database01Icon,
  File01Icon,
  Mail01Icon,
  StickyNoteIcon,
  Video01Icon,
} from '@/lib/icons'
import {
  KNOWLEDGE_TYPE_ICONS,
  KnowledgeStatusBadge,
  KnowledgeTypeBadge,
  KnowledgeTypeIcon,
  knowledgeTypeMeta,
} from './badges'

/* ----------------------------- Evidence icons ---------------------------- */

const EVIDENCE_ICONS: Record<Evidence['kind'], typeof File01Icon> = {
  email: Mail01Icon,
  meeting: Video01Icon,
  crm: Database01Icon,
  document: File01Icon,
  chat: ChatBotIcon,
  note: StickyNoteIcon,
}

const EVIDENCE_LABELS: Record<Evidence['kind'], string> = {
  email: 'Email',
  meeting: 'Réunion',
  crm: 'CRM',
  document: 'Document',
  chat: 'Discussion',
  note: 'Note',
}

export function EvidenceCard({ evidence, index }: { evidence: Evidence; index: number }) {
  const Icon = EVIDENCE_ICONS[evidence.kind]
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border-button-default bg-background-primary-default p-3">
      <HugeIcon icon={Icon} size="md" className="mt-0.5 shrink-0 text-foreground-icon-tertiary" />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-caption-1-semibold text-text-tertiary tabular-nums">
            {String(index + 1).padStart(2, '0')}
          </span>
          <p className="truncate text-body-2-medium text-text-primary">{evidence.title}</p>
        </div>
        <p className="text-caption-1-medium text-text-tertiary">
          {EVIDENCE_LABELS[evidence.kind]} · {evidence.author} · {evidence.date}
        </p>
      </div>
    </div>
  )
}

/** Compact numbered source reference used in the Ask answer panel. */
export function SourceReference({ index, title, meta }: { index: number; title: string; meta?: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-background-primary-hover">
      <span className="flex size-5 shrink-0 items-center justify-center rounded-md bg-background-secondary-default text-caption-1-semibold text-text-secondary tabular-nums">
        {index}
      </span>
      <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{title}</span>
      {meta && <span className="shrink-0 text-caption-1-medium text-text-tertiary">{meta}</span>}
    </div>
  )
}

/* ------------------------------ Memory row ------------------------------- */

export function MemoryRow({
  memory,
  onClick,
  compact = false,
}: {
  memory: Memory
  onClick?: () => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'flex w-full items-center gap-3 border-b border-separator-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background-primary-hover',
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
        <KnowledgeTypeIcon type={memory.type} size="sm" className="text-foreground-icon-secondary" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-body-medium text-text-primary">{memory.title}</span>
          {knowledgeTypeMeta(memory.type) && <KnowledgeTypeBadge type={memory.type} />}
        </span>
        {!compact && (
          <span className="mt-0.5 block truncate text-caption-1-medium text-text-tertiary">
            {memory.scope} · {memory.ownerName} · {memory.updated}
          </span>
        )}
      </span>
      <span className="hidden w-24 shrink-0 md:block">
        <ConfidenceMini value={memory.confidence} />
      </span>
      <span className="shrink-0">
        <KnowledgeStatusBadge status={memory.status} />
      </span>
    </button>
  )
}

function ConfidenceMini({ value }: { value: number }) {
  const tone =
    value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <span className="flex items-center gap-2">
      <span className="h-1 w-12 overflow-hidden rounded-full bg-background-tertiary-default">
        <span className={cx('block h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </span>
      <span className="text-caption-1-semibold text-text-secondary tabular-nums">{value} %</span>
    </span>
  )
}

/** Icon + label for a knowledge type (used in filters and empty states). */
export function KnowledgeTypeLabel({ type }: { type: KnowledgeType }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body-2-medium text-text-secondary">
      <HugeIcon icon={KNOWLEDGE_TYPE_ICONS[type]} size="xs" className="text-foreground-icon-tertiary" />
      {knowledgeTypeMeta(type).label}
    </span>
  )
}
