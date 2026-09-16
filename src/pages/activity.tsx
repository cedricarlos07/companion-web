import { useMemo, useState } from 'react'
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
  EyeIcon,
  CheckmarkBadge01Icon,
} from '@/lib/icons'
import { ACTIVITY } from '@/data/workspace'
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
  suggested: { label: 'Suggestion', cls: 'bg-status-yellow-background text-status-yellow-text' },
  autonomous: { label: 'Action autonome', cls: 'bg-status-blue-background text-status-blue-text' },
  approval: { label: 'Validation requise', cls: 'bg-status-yellow-background text-status-yellow-text' },
  verified: { label: 'Résultat vérifié', cls: 'bg-status-lime-background text-status-lime-text' },
}

const FILTERS: (ActivityKind | 'all')[] = [
  'all',
  'agents',
  'users',
  'knowledge',
  'sources',
  'security',
  'approvals',
]

export function ActivityPage() {
  const [filter, setFilter] = useState<ActivityKind | 'all'>('all')

  const list = useMemo(
    () => (filter === 'all' ? ACTIVITY : ACTIVITY.filter((a) => a.kind === filter)),
    [filter],
  )

  return (
    <div>
      <PageHeader
        title="Activité"
        subtitle="Journal d'audit de votre instance — humains et agents."
      />

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
        <ol className="relative px-4 py-2">
          {list.map((e, i) => {
            const meta = KIND_META[e.kind]
            const origin = ORIGIN_META[e.origin]
            return (
              <li key={e.id} className="relative flex gap-4 pb-5 last:pb-2">
                {i < list.length - 1 && (
                  <span className="absolute top-8 left-[19px] h-full w-px bg-separator-border" aria-hidden />
                )}
                <span className="w-10 shrink-0 pt-1 text-right text-caption-1-semibold text-text-tertiary tabular-nums">
                  {e.time}
                </span>
                <span className="z-10 flex size-10 shrink-0 items-center justify-center rounded-full border border-border-button-default bg-background-primary-default">
                  <HugeIcon icon={meta.icon} size="sm" className="text-foreground-icon-secondary" />
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-2-semibold text-text-primary">{e.actor}</span>
                    <span
                      className={cx(
                        e.actorKind === 'agent' ? 'text-accent-600' : 'text-text-tertiary',
                        'text-caption-1-medium',
                      )}
                    >
                      {e.actorKind === 'agent' ? 'Agent' : e.actorKind === 'admin' ? 'Administrateur' : 'Utilisateur'}
                    </span>
                    <span className={cx('rounded-md px-1.5 py-0.5 text-caption-2-medium', origin.cls)}>
                      {origin.label}
                    </span>
                  </div>
                  <p className="mt-0.5 text-body-2-medium text-text-primary">{e.action}</p>
                  <p className="text-caption-1-regular text-text-secondary">{e.detail}</p>
                </div>
                <button
                  type="button"
                  className="mt-1 shrink-0 rounded-md p-1.5 text-text-tertiary hover:bg-background-primary-hover hover:text-text-secondary"
                  aria-label="Voir le détail"
                  onClick={() => undefined}
                >
                  <HugeIcon icon={EyeIcon} size="xs" />
                </button>
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-background-secondary-default px-4 py-3 text-caption-1-medium text-text-secondary">
        <HugeIcon icon={Alert02Icon} size="xs" className="shrink-0 text-accent-500" />
        Conformité : journal conservé 24 mois, exportable pour audit. Actions d'agents et décisions
        humaines y sont distinguées.
      </div>
    </div>
  )
}
