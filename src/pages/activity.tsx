import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  Activity01Icon,
  Alert02Icon,
  BotIcon,
  Database01Icon,
  Shield01Icon,
  UserGroupIcon,
  CheckmarkBadge01Icon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { cx } from '@/utils/cx'
import type { ActivityKind } from '@/types'

const KIND_META: Record<ActivityKind, { label: string; icon: typeof BotIcon }> = {
  agents: { label: 'Agents', icon: BotIcon },
  users: { label: 'Utilisateurs', icon: UserGroupIcon },
  knowledge: { label: 'Connaissances', icon: Database01Icon },
  sources: { label: 'Sources', icon: Database01Icon },
  security: { label: 'Sécurité', icon: Shield01Icon },
  approvals: { label: 'Approbations', icon: CheckmarkBadge01Icon },
}

const ORIGIN_META: Record<string, { label: string; cls: string }> = {
  human: { label: 'Action humaine', cls: 'bg-background-tertiary-default text-text-secondary' },
  agent: { label: "Action d'agent", cls: 'bg-status-blue-background text-status-blue-text' },
  system: { label: 'Système', cls: 'bg-background-tertiary-default text-text-secondary' },
}

const FILTERS: (ActivityKind | 'all')[] = [
  'all',
  'agents',
  'knowledge',
  'security',
  'approvals',
]

interface AuditEventRow {
  id: string
  actor_name: string | null
  actor_kind: string | null
  action: string
  target_type: string | null
  detail: Record<string, unknown> | null
  created_at: string
}

function kindOf(action: string): ActivityKind {
  if (action.startsWith('agent') || action.startsWith('handover') || action.startsWith('onboarding') || action.startsWith('run')) return 'agents'
  if (action.startsWith('memory') || action.startsWith('ask') || action.startsWith('source') || action.startsWith('doc')) return 'knowledge'
  if (action.startsWith('approval')) return 'approvals'
  if (action.startsWith('auth') || action.startsWith('org') || action.startsWith('backup') || action.startsWith('system') || action.startsWith('invitation')) return 'security'
  return 'security'
}

export function ActivityPage() {
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all')
  const [events, setEvents] = useState<AuditEventRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.audit().then((real) => {
      if (real === null) {
        setError("Impossible de charger le journal d'audit — backend indisponible.")
        setEvents([])
        return
      }
      setEvents(real as unknown as AuditEventRow[])
    })
  }, [])

  const list = useMemo(
    () => (filter === 'all' ? (events ?? []) : (events ?? []).filter((e) => kindOf(e.action) === filter)),
    [filter, events],
  )

  return (
    <div>
      <PageHeader
        title="Activité"
        subtitle="Journal d'audit de votre instance — humains et agents."
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => {
          const meta = f === 'all' ? null : KIND_META[f]
          const active = filter === f
          return (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={active}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-body-2-medium transition-colors',
                active
                  ? 'border-accent-500 bg-accent-50 text-accent-700'
                  : 'border-border-button-default text-text-secondary hover:bg-background-primary-hover',
              )}
            >
              {meta ? <HugeIcon icon={meta.icon} size="xs" /> : <HugeIcon icon={Activity01Icon} size="xs" />}
              {f === 'all' ? 'Tout' : meta!.label}
            </button>
          )
        })}
      </div>

      <Card bodyClassName="p-0">
        {events === null ? (
          <p className="px-4 py-4 text-body-2-medium text-text-tertiary">Chargement du journal…</p>
        ) : list.length === 0 ? (
          <p className="px-4 py-4 text-body-2-medium text-text-secondary">Aucun événement pour ce filtre.</p>
        ) : (
          <ol className="relative px-4 py-2">
            {list.map((e, i) => {
              const meta = KIND_META[kindOf(e.action)]
              const origin = ORIGIN_META[e.actor_kind ?? 'human'] ?? ORIGIN_META.human
              const when = new Date(e.created_at)
              const time = Number.isNaN(when.getTime())
                ? e.created_at
                : when.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })
              return (
                <li key={e.id} className="relative flex gap-4 pb-5 last:pb-2">
                  {i < list.length - 1 && (
                    <span className="absolute top-8 left-[19px] h-full w-px bg-separator-border" aria-hidden />
                  )}
                  <span className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border-button-default bg-background-primary-default">
                    <HugeIcon icon={meta.icon} size="sm" className="text-foreground-icon-secondary" />
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body-2-semibold text-text-primary">{e.actor_name ?? 'système'}</span>
                      <span
                        className={cx(
                          e.actor_kind === 'agent' ? 'text-accent-600' : 'text-text-tertiary',
                          'text-caption-1-medium',
                        )}
                      >
                        {e.actor_kind === 'agent' ? 'Agent' : e.actor_kind === 'system' ? 'Système' : 'Utilisateur'}
                      </span>
                      <span className={cx('rounded-md px-1.5 py-0.5 text-caption-2-medium', origin.cls)}>
                        {origin.label}
                      </span>
                      <span className="text-caption-1-medium text-text-tertiary">{time}</span>
                    </div>
                    <p className="mt-0.5 text-body-2-medium text-text-primary">{e.action}</p>
                    {e.detail && Object.keys(e.detail).length > 0 && (
                      <p className="truncate text-caption-1-regular text-text-secondary">
                        {JSON.stringify(e.detail)}
                      </p>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </Card>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-background-secondary-default px-4 py-3 text-caption-1-medium text-text-secondary">
        <HugeIcon icon={Alert02Icon} size="xs" className="shrink-0 text-accent-500" />
        Journal d'audit serveur — 100 derniers événements. Actions d'agents et décisions humaines y
        sont distinguées.
      </div>
    </div>
  )
}
