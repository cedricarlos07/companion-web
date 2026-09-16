import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, StatCard } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow } from '@/components/common/progress'
import { RiskBadge, KnowledgeTypeBadge, knowledgeTypeMeta, CriticalBadge } from '@/components/common/badges'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/base/buttons/button'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { adaptIcon, HugeIcon } from '@/components/ui/huge-icon'
import {
  AiBrain01Icon,
  AiChat02Icon,
  Exchange01Icon,
  FileValidationIcon,
  ChartColumnIcon,
  Alert02Icon,
} from '@/lib/icons'
import { fullName, getEmployee, MOUSSA_UNIQUE_KNOWLEDGE } from '@/data/employees'
import { MEMORIES } from '@/data/memories'
import { PROJECTS } from '@/data/workspace'
import { api, mapEmployee, mapMemory } from '@/services/api'
import { formatNumber } from '@/lib/format'
import type { Employee, Memory } from '@/types'

function mapMemoryShim(row: Record<string, unknown>): Memory {
  return mapMemory({
    ...row,
    role_title: row.role_title ?? '',
    employee_name: row.employee_name ?? '',
  })
}

export function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const mockEmployee = id ? getEmployee(id) : undefined

  // Employé réel (UUID) quand l'id n'est pas un id de démo.
  const [realEmployee, setRealEmployee] = useState<Employee | null>(null)
  const [realMemories, setRealMemories] = useState<Memory[]>([])
  const [realRisk, setRealRisk] = useState<{ score: number; level: string; factors: { key: string; label: string; value: number; weight: number; detail: string }[] } | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (mockEmployee || !id) return
    setLoading(true)
    api.employee(id).then((res) => {
      setLoading(false)
      if (!res?.employee) return
      setRealEmployee(mapEmployee(res.employee))
      setRealMemories((res.memories ?? []).map((m) => ({
        ...mapMemoryShim(m),
      })) as Memory[])
      setRealRisk(res.risk)
    })
  }, [id, mockEmployee])

  const employee: Employee | undefined = mockEmployee ?? realEmployee ?? undefined

  const employeeMemories: Memory[] = employee
    ? mockEmployee
      ? MEMORIES.filter((m) => m.ownerId === employee.id)
      : realMemories
    : []
  const employeeProjects = employee
    ? PROJECTS.filter((p) => p.members.some((m) => m.startsWith(employee.firstName)))
    : []

  if (!employee) {
    if (loading) {
      return (
        <EmptyState title="Chargement du profil…" />
      )
    }
    return (
      <EmptyState
        title="Collaborateur introuvable."
        action={<Button onClick={() => navigate('/people')}>Retour aux personnes</Button>}
      />
    )
  }

  const name = fullName(employee)
  const isMoussa = employee.firstName === 'Moussa'

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <PersonAvatar name={name} size="lg" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-title-1-medium text-text-primary">{name}</h1>
              {employee.status === 'leaving' && <CriticalBadge />}
            </div>
            <p className="mt-0.5 text-body-medium text-text-secondary">
              {employee.roleTitle} · {employee.department} ·{' '}
              {employee.tenureYears > 0
                ? `${employee.tenureYears} ans dans l'entreprise`
                : `Arrivée le ${employee.startDate}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" leadingIcon={adaptIcon(AiChat02Icon, 20)} onClick={() => navigate('/ask')}>
            Demander à Companion
          </Button>
          <Button leadingIcon={adaptIcon(Exchange01Icon, 20)} onClick={() => navigate(`/handovers/new/${employee.id}`)}>
            Préparer le départ
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Connaissances" value={formatNumber(employee.memories)} icon={AiBrain01Icon} />
        <StatCard label="Procédures" value={String(employee.procedures)} icon={FileValidationIcon} />
        <StatCard
          label="Connaissances uniques"
          value={String(employee.uniqueKnowledge)}
          icon={Alert02Icon}
          tone={employee.uniqueKnowledge > 10 ? 'critical' : 'default'}
        />
        <StatCard label="Couverture" value={`${employee.coverage} %`} icon={ChartColumnIcon} />
      </div>

      {/* Unique knowledge alert */}
      {!mockEmployee && realRisk && (
        <Card
          className="mb-5"
          title={
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-headline-medium text-text-primary">Risque de savoir — explicable</h2>
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-caption-1-semibold text-amber-800">
                Score {realRisk.score} / 100 ({realRisk.level})
              </span>
            </div>
          }
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {realRisk.factors.map((f) => (
              <li key={f.key} className="flex items-start justify-between gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                <span className="min-w-0 text-caption-1-regular text-text-secondary">
                  <span className="font-medium text-text-primary">{f.label}</span> (poids {f.weight} %) — {f.detail}
                </span>
                <span className="shrink-0 text-body-2-semibold text-text-primary tabular-nums">{f.value} %</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {isMoussa && mockEmployee && (
        <Card
          className="mb-5"
          title={
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-headline-medium text-text-primary">Connaissances uniques</h2>
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-caption-1-semibold text-amber-800">
                {employee.uniqueKnowledge} éléments dépendent principalement de Moussa
              </span>
            </div>
          }
          actions={
            <Button size="xs" onClick={() => navigate(`/handovers/new/${employee.id}`)}>
              Documenter maintenant
            </Button>
          }
        >
          <ul className="space-y-2">
            {MOUSSA_UNIQUE_KNOWLEDGE.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5"
              >
                <HugeIcon
                  icon={Alert02Icon}
                  size="sm"
                  className={k.risk === 'critical' ? 'shrink-0 text-rose-500' : 'shrink-0 text-amber-500'}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-2-medium text-text-primary">{k.title}</p>
                  <p className="truncate text-caption-1-medium text-text-tertiary">{k.detail}</p>
                </div>
                <KnowledgeTypeBadge type={k.type} />
                <RiskBadge risk={k.risk === 'critical' ? 'critical' : k.risk === 'high' ? 'high' : 'moderate'} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultSelectedKey="overview">
        <TabList aria-label="Sections du profil">
          <Tab id="overview">Aperçu</Tab>
          <Tab id="knowledge">Connaissances</Tab>
          <Tab id="projects">Projets</Tab>
          <Tab id="relationships">Relations</Tab>
          <Tab id="activity">Activité</Tab>
        </TabList>

        <TabPanel id="overview" className="pt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Couverture du poste">
              <div className="space-y-3">
                {employee.risk !== undefined && !mockEmployee && (
                  <ProgressRow label="Couverture estimée" value={employee.coverage} />
                )}
                <ProgressRow label="Procédures documentées" value={isMoussa ? 79 : 82} />
                <ProgressRow label="Décisions expliquées" value={isMoussa ? 68 : 74} />
                <ProgressRow label="Relations cartographiées" value={isMoussa ? 91 : 80} />
                <ProgressRow label="Tâches récurrentes" value={isMoussa ? 74 : 77} />
              </div>
            </Card>
            <Card title={`Connaissances récentes de ${name}`}>
              {employeeMemories.length === 0 ? (
                <p className="py-6 text-center text-body-2-regular text-text-tertiary">
                  Aucune connaissance capturée pour le moment.
                </p>
              ) : (
                <ul className="space-y-1">
                  {employeeMemories.slice(0, 4).map((m) => (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/brain/${m.id}`)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background-primary-hover"
                      >
                        <KnowledgeTypeBadge type={m.type} />
                        <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">
                          {m.title}
                        </span>
                        <span className="shrink-0 text-caption-1-medium text-text-tertiary">{m.updated}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="knowledge" className="pt-4">
          <Card bodyClassName="p-0">
            {employeeMemories.length === 0 ? (
              <EmptyState
                title="Aucune connaissance enregistrée."
                detail="Les connaissances apparaîtront ici dès la première analyse."
              />
            ) : (
              <ul>
                {employeeMemories.map((m) => (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/brain/${m.id}`)}
                      className="flex w-full items-center gap-3 border-b border-separator-border px-4 py-3 text-left last:border-b-0 hover:bg-background-primary-hover"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body-medium text-text-primary">{m.title}</span>
                        <span className="block text-caption-1-medium text-text-tertiary">
                          {knowledgeTypeMeta(m.type).label} · {m.updated}
                        </span>
                      </span>
                      <span className="text-body-2-semibold text-text-secondary tabular-nums">
                        {m.confidence} %
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="projects" className="pt-4">
          <Card>
            {employeeProjects.length === 0 ? (
              <p className="py-6 text-center text-body-2-regular text-text-tertiary">Aucun projet actif.</p>
            ) : (
              <ul className="space-y-2">
                {employeeProjects.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-3 rounded-xl border border-border-button-default p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-2-medium text-text-primary">{p.name}</p>
                      <p className="text-caption-1-medium text-text-tertiary">
                        {p.clientName} · {p.updated}
                      </p>
                    </div>
                    <span className="text-caption-1-medium text-text-secondary">
                      {p.status === 'active' ? 'Actif' : p.status === 'at-risk' ? 'À risque' : 'En clôture'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="relationships" className="pt-4">
          <Card>
            <p className="text-body-2-regular text-text-secondary">
              Clients et interlocuteurs associés à {name}, cartographiés depuis le Company Brain.
            </p>
          </Card>
        </TabPanel>

        <TabPanel id="activity" className="pt-4">
          <Card>
            <p className="text-body-2-regular text-text-secondary">
              Dernière activité : {employee.lastActive}.
            </p>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}
