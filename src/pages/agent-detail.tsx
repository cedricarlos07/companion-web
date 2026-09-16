import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { AgentStatusBadge, AutonomyBadge, autonomyDescription } from '@/components/common/badges'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { Button } from '@/components/base/buttons/button'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  BotIcon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  PlayIcon,
  CheckmarkBadge01Icon,
  CancelCircleIcon,
  Database01Icon,
  ShieldCheckIcon,
} from '@/lib/icons'
import { getAgent } from '@/data/workspace'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const PERM_ICON: Record<string, typeof CheckmarkCircle02Icon> = {
  automatic: CheckmarkCircle02Icon,
  approval: CheckmarkBadge01Icon,
  blocked: CancelCircleIcon,
}

export function AgentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { agents, setAgentStatus, pushToast } = useAppStore()
  const agent = id ? agents.find((a) => a.id === id) ?? (id ? getAgent(id) : undefined) : undefined

  if (!agent) {
    return (
      <EmptyState
        title="Agent introuvable."
        action={<Button onClick={() => navigate('/agents')}>Retour aux agents</Button>}
      />
    )
  }

  const isPaused = agent.status === 'paused'

  return (
    <div>
      <PageHeader
        title={agent.name}
        subtitle={agent.description}
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate('/agents')} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Agents
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{agent.name}</span>
          </nav>
        }
        actions={
          <>
            <span className="mr-1 flex items-center gap-2">
              <AgentStatusBadge status={agent.status} />
              <AutonomyBadge autonomy={agent.autonomy} />
            </span>
            <Button
              variant="secondary"
              leadingIcon={isPaused ? adaptIcon(PlayIcon, 20) : adaptIcon(Cancel01Icon, 20)}
              onClick={() => {
                setAgentStatus(agent.id, isPaused ? 'running' : 'paused')
                pushToast(isPaused ? `${agent.name} relancé.` : `${agent.name} mis en pause.`, isPaused ? 'success' : 'info')
              }}
            >
              {isPaused ? 'Reprendre' : 'Mettre en pause'}
            </Button>
            <Button
              leadingIcon={adaptIcon(PlayIcon, 20)}
              onClick={() => pushToast(`Nouvelle tâche lancée pour ${agent.name} (démo).`)}
            >
              Lancer une tâche
            </Button>
          </>
        }
      />

      <Tabs defaultSelectedKey="overview">
        <TabList aria-label="Sections de l'agent">
          <Tab id="overview">Aperçu</Tab>
          <Tab id="activity">Activité</Tab>
          <Tab id="skills">Compétences</Tab>
          <Tab id="tools">Outils</Tab>
          <Tab id="memory">Mémoire</Tab>
          <Tab id="permissions">Permissions</Tab>
        </TabList>

        <TabPanel id="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Objectif">
              <p className="text-body-2-regular text-text-primary">{agent.goal}</p>
              <div className="mt-4 rounded-xl bg-background-secondary-default p-3.5">
                <p className="flex items-center gap-2 text-caption-1-semibold text-text-secondary">
                  <HugeIcon icon={ShieldCheckIcon} size="xs" />
                  Niveau d'autonomie
                </p>
                <p className="mt-1 flex items-center gap-2">
                  <AutonomyBadge autonomy={agent.autonomy} />
                  <span className="text-caption-1-medium text-text-tertiary">{autonomyDescription(agent.autonomy)}</span>
                </p>
              </div>
            </Card>
            <Card title="Activité récente">
              <ul className="space-y-2.5">
                {agent.recent.map((r) => (
                  <li key={r.id} className="flex items-start gap-2.5">
                    <span className="mt-0.5 shrink-0 text-caption-1-medium text-text-tertiary tabular-nums">{r.time}</span>
                    <span className="min-w-0 text-body-2-regular text-text-primary">{r.detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="activity" className="pt-4">
          <Card>
            <ul className="space-y-3">
              {agent.recent.map((r) => (
                <li key={r.id} className="flex items-start gap-3 border-b border-separator-border pb-3 last:border-b-0 last:pb-0">
                  <HugeIcon icon={BotIcon} size="sm" className="mt-0.5 shrink-0 text-foreground-icon-tertiary" />
                  <div className="min-w-0">
                    <p className="text-body-2-regular text-text-primary">{r.detail}</p>
                    <p className="text-caption-1-medium text-text-tertiary">{r.time}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel id="skills" className="pt-4">
          <Card>
            <ul className="flex flex-wrap gap-2">
              {agent.skills.map((s) => (
                <li key={s} className="rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-body-2-medium text-text-primary">
                  {s}
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel id="tools" className="pt-4">
          <Card>
            <ul className="grid gap-2 sm:grid-cols-2">
              {agent.tools.map((t) => (
                <li key={t} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <HugeIcon icon={Database01Icon} size="sm" className="text-foreground-icon-tertiary" />
                  <span className="text-body-2-medium text-text-primary">{t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel id="memory" className="pt-4">
          <Card title="Accès à la mémoire">
            <ul className="space-y-2">
              {agent.memoryAccess.map((m) => (
                <li
                  key={m.scope}
                  className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5"
                >
                  <span className="min-w-0 flex-1 text-body-2-medium text-text-primary">{m.scope}</span>
                  <span
                    className={cx(
                      'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-caption-1-medium',
                      m.allowed
                        ? 'bg-status-lime-background text-status-lime-text'
                        : 'bg-status-rose-background text-status-rose-text',
                    )}
                  >
                    <HugeIcon icon={m.allowed ? CheckmarkCircle02Icon : CancelCircleIcon} size="xs" />
                    {m.allowed ? 'Autorisé' : 'Refusé'}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>

        <TabPanel id="permissions" className="pt-4">
          <Card title="Permissions d'action">
            <ul className="space-y-2">
              {agent.permissions.map((p) => {
                const Icon = PERM_ICON[p.mode]
                return (
                  <li
                    key={p.action}
                    className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5"
                  >
                    <span className="min-w-0 flex-1 text-body-2-medium text-text-primary">{p.action}</span>
                    <span
                      className={cx(
                        'inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-caption-1-medium',
                        p.mode === 'automatic'
                          ? 'bg-status-lime-background text-status-lime-text'
                          : p.mode === 'approval'
                            ? 'bg-status-yellow-background text-status-yellow-text'
                            : 'bg-status-rose-background text-status-rose-text',
                      )}
                    >
                      <HugeIcon icon={Icon} size="xs" />
                      {p.mode === 'automatic' ? 'Automatique' : p.mode === 'approval' ? 'Validation requise' : 'Bloqué'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}
