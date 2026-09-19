import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Card, StatCard } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow } from '@/components/common/progress'
import { KnowledgeTypeBadge, knowledgeTypeMeta, CriticalBadge } from '@/components/common/badges'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/base/buttons/button'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { adaptIcon } from '@/components/ui/huge-icon'
import {
  AiBrain01Icon,
  AiChat02Icon,
  Exchange01Icon,
  FileValidationIcon,
  ChartColumnIcon,
  Alert02Icon,
} from '@/lib/icons'
import { api, mapEmployee, mapMemory } from '@/services/api'
import { formatNumber } from '@/lib/format'
import type { Employee, Memory } from '@/types'

interface RiskData {
  score: number
  level: string
  factors: { key: string; label: string; value: number; weight: number; detail: string }[]
  stats: Record<string, number>
}

export function EmployeeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [memories, setMemories] = useState<Memory[]>([])
  const [risk, setRisk] = useState<RiskData | null>(null)
  const [handovers, setHandovers] = useState<{ id: string; status: string; readiness: number; created_at: string }[]>([])
  const [onboardings, setOnboardings] = useState<{ id: string; created_at: string }[]>([])
  const [notFound, setNotFound] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const res = await api.employee(id)
    if (res === null || !res.employee) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setEmployee(mapEmployee(res.employee))
    setMemories((res.memories ?? []).map((m) => mapMemory({
      ...m,
      role_title: (m as Record<string, unknown>).role_title ?? '',
      employee_name: (m as Record<string, unknown>).employee_name ?? '',
    })))
    setRisk(res.risk ?? null)
    const hv = await api.request<{ handovers: Record<string, unknown>[] }>('/handovers')
    setHandovers((hv?.handovers ?? [])
      .filter((h) => h.employee_id === id)
      .map((h) => ({
        id: String(h.id),
        status: String(h.status ?? 'analyzing'),
        readiness: Number(h.readiness ?? 0),
        created_at: String(h.created_at ?? ''),
      })))
    const onb = await api.onboardings() as unknown as { id: string; employee_id: string; created_at: string }[] | null
    setOnboardings((onb ?? [])
      .filter((o) => o.employee_id === id)
      .map((o) => ({ id: String(o.id ?? o['id']), created_at: String(o.created_at ?? '') })))
    setLoading(false)
  }, [id])

  useEffect(() => {
    void load()
  }, [load])


  const employeeMemories = memories

  if (notFound) {
    if (loading) return <EmptyState title="Chargement du profil…" />
    return (
      <EmptyState
        title="Collaborateur introuvable."
        action={<Button onClick={() => navigate('/people')}>Retour aux personnes</Button>}
      />
    )
  }
  if (!employee) {
    return <EmptyState title="Chargement du profil…" />
  }

  const name = `${employee.firstName} ${employee.lastName}`
  const projectMemories = memories.filter((m) => m.type === 'project')
  const relationshipMemories = memories.filter((m) => m.type === 'relationship')

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

      {/* Risk factors — explicable, from computeEmployeeRisk */}
      {risk && (
        <Card
          className="mb-5"
          title={
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-headline-medium text-text-primary">Risque de savoir — explicable</h2>
              <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-caption-1-semibold text-amber-800">
                Score {risk.score} / 100 ({risk.level})
              </span>
            </div>
          }
        >
          <ul className="grid gap-2 sm:grid-cols-2">
            {risk.factors.map((f) => (
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

      {/* Handovers + Onboarding réels */}
      <div className="mb-5 grid gap-4 lg:grid-cols-2">
        <Card title="Handovers">
          {handovers.length === 0 ? (
            <p className="text-body-2-medium text-text-tertiary">Aucun handover pour cet employé.</p>
          ) : (
            <ul className="space-y-2">
              {handovers.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <button type="button" onClick={() => navigate(`/handovers/${h.id}`)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-body-2-medium text-text-primary">
                      Handover {h.created_at.slice(0, 10)}
                    </span>
                    <span className="text-caption-1-medium text-text-tertiary">préparation {h.readiness} %</span>
                  </button>
                  <Button variant="secondary" size="xs" onClick={() => navigate(`/handovers/${h.id}`)}>
                    Ouvrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Onboarding">
          {onboardings.length === 0 ? (
            <p className="text-body-2-medium text-text-tertiary">Aucun parcours d'intégration.</p>
          ) : (
            <ul className="space-y-2">
              {onboardings.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">
                    Parcours démarré le {o.created_at.slice(0, 10)}
                  </span>
                  <Button variant="secondary" size="xs" onClick={() => navigate(`/onboarding/${o.id}`)}>
                    Ouvrir
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

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
                <ProgressRow label="Couverture estimée" value={employee.coverage} />
                {risk?.stats && Object.entries(risk.stats).length > 0 && (
                  <p className="text-caption-1-medium text-text-tertiary">
                    Détail du risque calculé côté serveur — voir la section Risque de savoir ci-dessus.
                  </p>
                )}
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
            {projectMemories.length === 0 ? (
              <p className="py-6 text-center text-body-2-regular text-text-tertiary">Aucun projet actif documenté.</p>
            ) : (
              <ul className="space-y-2">
                {projectMemories.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border-button-default p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-2-medium text-text-primary">{p.title}</p>
                      <p className="text-caption-1-medium text-text-tertiary">{p.updated}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="relationships" className="pt-4">
          <Card>
            {relationshipMemories.length === 0 ? (
              <p className="text-body-2-regular text-text-tertiary">
                Aucune relation cartographiée pour le moment.
              </p>
            ) : (
              <ul className="space-y-2">
                {relationshipMemories.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl border border-border-button-default p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-2-medium text-text-primary">{r.title}</p>
                      <p className="text-caption-1-medium text-text-tertiary">
                        {r.scope} · {r.updated}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="activity" className="pt-4">
          <Card>
            <p className="text-body-2-regular text-text-secondary">
              Handovers : {handovers.length} · onboardings : {onboardings.length} · mémoires :{' '}
              {memories.length}. Le détail complet des actions est dans le journal d'audit de
              l'organisation (Contrôle → Activité).
            </p>
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}
