import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card, StatCard } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { RiskBadge, KnowledgeTypeBadge } from '@/components/common/badges'
import { EmptyState } from '@/components/common/states'
import { ProgressRow } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { AiBrain01Icon, FileValidationIcon, GavelIcon, UserGroupIcon, ChartColumnIcon } from '@/lib/icons'
import { getRole } from '@/data/roles'
import { MEMORIES } from '@/data/memories'
import { formatNumber } from '@/lib/format'
import { cx } from '@/utils/cx'

export function RoleBrainPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const role = id ? getRole(id) : undefined

  const roleMemories = useMemo(() => {
    if (!role) return []
    return MEMORIES.filter((m) => m.roleTitle === role.title)
  }, [role])

  const filteredByTab = (types: string[]) =>
    roleMemories.filter((m) => types.includes(m.type))

  if (!role) {
    return (
      <EmptyState
        title="Rôle introuvable."
        action={<Button onClick={() => navigate('/roles')}>Retour aux rôles</Button>}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title={`Role Brain — ${role.title}`}
        subtitle="Mémoire collective accumulée par les personnes ayant occupé ce rôle."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button
              type="button"
              onClick={() => navigate('/roles')}
              className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary"
            >
              Rôles
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{role.title}</span>
          </nav>
        }
        actions={<RiskBadge risk={role.risk} label={`Risque : ${role.risk === 'critical' ? 'critique' : role.risk === 'moderate' ? 'modéré' : 'faible'}`} />}
      />

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
        <StatCard label="Connaissances" value={formatNumber(role.memories)} icon={AiBrain01Icon} />
        <StatCard label="Procédures" value={String(role.procedures)} icon={FileValidationIcon} />
        <StatCard label="Décisions" value={String(role.decisions)} icon={GavelIcon} />
        <StatCard label="Contributeurs" value={String(role.contributors)} icon={UserGroupIcon} />
        <StatCard label="Couverture" value={`${role.coverage} %`} icon={ChartColumnIcon} />
      </div>

      {/* Contributor timeline — the institutional knowledge survives turnover */}
      <Card title="Contributeurs du rôle" className="mb-5">
        <p className="mb-4 text-body-2-regular text-text-secondary">
          Le savoir de ce rôle a été construit par plusieurs personnes. Quand l'une part, ses contributions
          restent dans la mémoire du rôle.
        </p>
        <ol className="relative space-y-0">
          {role.contributorTimeline.map((c, i) => {
            const isCurrent = c.to === "Aujourd'hui"
            return (
              <li key={`${c.name}-${i}`} className="relative flex items-center gap-4 pb-5 last:pb-0">
                {i < role.contributorTimeline.length - 1 && (
                  <span className="absolute top-10 left-5 h-full w-px bg-separator-border" aria-hidden />
                )}
                <span
                  className={cx(
                    'z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2',
                    isCurrent ? 'border-accent-500 bg-accent-50' : 'border-border-button-default bg-background-primary-default',
                  )}
                >
                  <PersonAvatar name={c.name} size="sm" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body-medium font-medium text-text-primary">{c.name}</span>
                    <span className="rounded-md bg-background-secondary-default px-1.5 py-0.5 text-caption-1-medium text-text-secondary tabular-nums">
                      {c.from} → {c.to}
                    </span>
                    {isCurrent && (
                      <span className="rounded-md bg-accent-100 px-1.5 py-0.5 text-caption-1-semibold text-accent-700">
                        En poste
                      </span>
                    )}
                  </div>
                  <p className="text-caption-1-medium text-text-secondary">
                    {formatNumber(c.contributions)} contributions au Role Brain
                  </p>
                </div>
                <div className="hidden w-40 shrink-0 sm:block">
                  <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
                    <div
                      className={cx('h-full rounded-full', isCurrent ? 'bg-accent-500' : 'bg-foreground-icon-quaternary')}
                      style={{
                        width: `${Math.min(100, (c.contributions / Math.max(...role.contributorTimeline.map((x) => x.contributions))) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      {/* Memory tabs */}
      <Tabs defaultSelectedKey="overview">
        <TabList aria-label="Sections du Role Brain">
          <Tab id="overview">Aperçu</Tab>
          <Tab id="procedures">Procédures</Tab>
          <Tab id="decisions">Décisions</Tab>
          <Tab id="lessons">Leçons</Tab>
          <Tab id="customers">Clients</Tab>
          <Tab id="projects">Projets</Tab>
          <Tab id="contributors">Contributeurs</Tab>
        </TabList>

        <TabPanel id="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Couverture">
              <div className="space-y-3">
                <ProgressRow label="Procédures documentées" value={role.coverage} />
                <ProgressRow label="Décisions avec rationale" value={Math.max(40, role.coverage - 12)} />
                <ProgressRow label="Leçons partagées" value={Math.min(96, role.coverage + 8)} />
              </div>
            </Card>
            <Card title="Connaissances récentes du rôle">
              {roleMemories.length === 0 ? (
                <p className="py-6 text-center text-body-2-regular text-text-tertiary">
                  Aucune connaissance rattachée directement à ce rôle.
                </p>
              ) : (
                <ul className="space-y-1">
                  {roleMemories.slice(0, 5).map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/brain/${m.id}`)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background-primary-hover"
                      >
                        <KnowledgeTypeBadge type={m.type} />
                        <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{m.title}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="procedures" className="pt-4">
          <MemoryList memories={filteredByTab(['procedure'])} />
        </TabPanel>
        <TabPanel id="decisions" className="pt-4">
          <MemoryList memories={filteredByTab(['decision'])} />
        </TabPanel>
        <TabPanel id="lessons" className="pt-4">
          <MemoryList memories={filteredByTab(['lesson'])} />
        </TabPanel>
        <TabPanel id="customers" className="pt-4">
          <MemoryList memories={filteredByTab(['relationship', 'preference'])} />
        </TabPanel>
        <TabPanel id="projects" className="pt-4">
          <MemoryList memories={filteredByTab(['project'])} />
        </TabPanel>
        <TabPanel id="contributors" className="pt-4">
          <Card>
            <ul className="space-y-2">
              {role.contributorTimeline.map((c, i) => (
                <li key={i} className="flex items-center gap-3 rounded-xl border border-border-button-default p-3">
                  <PersonAvatar name={c.name} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="text-body-2-medium text-text-primary">{c.name}</p>
                    <p className="text-caption-1-medium text-text-tertiary">
                      {c.from} → {c.to} · {formatNumber(c.contributions)} contributions
                    </p>
                  </div>
                  {c.employeeId && (
                    <Button variant="secondary" size="xs" onClick={() => navigate(`/people/${c.employeeId}`)}>
                      Voir le profil
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}

function MemoryList({ memories }: { memories: ReturnType<typeof MEMORIES.filter> }) {
  const navigate = useNavigate()
  if (memories.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-body-2-regular text-text-tertiary">
          Aucune connaissance de ce type pour ce rôle.
        </p>
      </Card>
    )
  }
  return (
    <Card bodyClassName="p-0">
      <ul>
        {memories.map((m) => (
          <li key={m.id}>
            <button
              type="button"
              onClick={() => navigate(`/brain/${m.id}`)}
              className="flex w-full items-center gap-3 border-b border-separator-border px-4 py-3 text-left last:border-b-0 hover:bg-background-primary-hover"
            >
              <KnowledgeTypeBadge type={m.type} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body-medium text-text-primary">{m.title}</span>
                <span className="block text-caption-1-medium text-text-tertiary">{m.scope} · {m.updated}</span>
              </span>
              <span className="text-body-2-semibold text-text-secondary tabular-nums">{m.confidence} %</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
