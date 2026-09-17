import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeIcon } from '@/components/ui/huge-icon'
import { Card, StatCard } from '@/components/common/stat-card'
import { ProgressRow, ScoreRing } from '@/components/common/progress'
import { PersonAvatar } from '@/components/common/person-avatar'
import { CriticalBadge, KnowledgeTypeBadge, RiskBadge, AgentStatusBadge } from '@/components/common/badges'
import {
  AiBrain01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowRight02Icon,
  BotIcon,
  CheckmarkCircle02Icon,
  Database01Icon,
  Exchange01Icon,
  HierarchyIcon,
  Loading03Icon,
  ShieldAlertIcon,
  Activity01Icon,
} from '@/lib/icons'
import { ORG, HOME_ROLE_RISKS, ATTENTION_ITEMS } from '@/data/org'
import { RECENT_KNOWLEDGE } from '@/data/memories'
import { HANDOVERS } from '@/data/continuity'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/base/buttons/button'
import { cx } from '@/utils/cx'
import { formatNumber } from '@/lib/format'
import type { KnowledgeType } from '@/types'

interface RecentKnowledgeItem {
  id: string
  type: KnowledgeType
  title: string
  source: string
  owner: string
  updated: string
  confidence: number
}

const severityIcon = {
  critical: AlertCircleIcon,
  warning: Alert02Icon,
  conflict: Alert02Icon,
} as const

export function HomePage() {
  const navigate = useNavigate()
  const { agents, approvals } = useAppStore()
  const activeAgents = agents.filter((a) => a.status === 'running' || a.status === 'thinking')
  const pending = approvals.filter((a) => a.status === 'pending')
  const moussaHandover = HANDOVERS.find((h) => h.employeeId === 'emp-moussa')

  // Vue d'ensemble réelle (stats, risque, connaissances récentes, transferts).
  const [live, setLive] = useState<Awaited<ReturnType<typeof api.overview>>>(null)
  const [riskByRole, setRiskByRole] = useState(HOME_ROLE_RISKS)
  const [recent, setRecent] = useState<RecentKnowledgeItem[]>(RECENT_KNOWLEDGE)
  const [liveHandover, setLiveHandover] = useState<{ id: string; employee_name: string; role_title: string | null; readiness: number } | null>(null)

  useEffect(() => {
    api.overview().then((o) => {
      if (!o) return
      setLive(o)
      if (o.risk.topEmployees.length > 0) {
        setRiskByRole(o.risk.topEmployees.map((e) => ({
          role: e.name,
          value: e.score,
          level: (e.level === 'critical' || e.level === 'high' ? 'critical' : e.level === 'moderate' ? 'moderate' : 'healthy') as 'critical' | 'moderate' | 'healthy',
        })))
      }
      if (o.recentMemories.length > 0) {
        setRecent(o.recentMemories.map((m) => ({
          id: String(m.id),
          type: String(m.type) as KnowledgeType,
          title: String(m.title),
          source: String(m.contributor ?? 'Company Brain'),
          owner: String(m.contributor ?? '—'),
          updated: String(m.updated_at ?? '').slice(0, 10),
          confidence: Number(m.confidence ?? 50),
        })))
      }
      if (o.handovers.length > 0) {
        const h = o.handovers[0]
        setLiveHandover({ id: String(h.id), employee_name: String(h.employee_name), role_title: h.role_title ? String(h.role_title) : null, readiness: Number(h.readiness) })
      }
    })
  }, [])

  const stats = live?.stats ?? { memories: ORG.memories, employees: ORG.employees, roles: ORG.rolesCount, documents: 0, handovers: 0 }
  const criticalRisks = live?.risk.criticalPeople ?? ORG.criticalRisks

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-1-medium text-text-primary">Bonjour Ange</h1>
          <p className="mt-1 text-body-medium text-text-secondary">
            Voici ce que votre organisation sait, apprend et risque d'oublier.
          </p>
        </div>
        <p className="text-caption-1-medium text-text-tertiary">
          {stats.employees} employés · {stats.roles} rôles · {ORG.instance}
        </p>
      </header>

      {/* Executive stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Connaissances"
          value={formatNumber(stats.memories)}
          icon={AiBrain01Icon}
          onClick={() => navigate('/brain')}
        />
        <StatCard
          label="Couverture"
          value={`${ORG.coverage} %`}
          icon={Database01Icon}
          hint="Part du savoir capturé"
          onClick={() => navigate('/knowledge-risk')}
        />
        <StatCard
          label="Rôles actifs"
          value={formatNumber(stats.roles)}
          icon={HierarchyIcon}
          onClick={() => navigate('/roles')}
        />
        <StatCard
          label="Risques critiques"
          value={String(criticalRisks)}
          icon={ShieldAlertIcon}
          tone="critical"
          onClick={() => navigate('/knowledge-risk')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Memory health */}
        <Card title="Santé de la mémoire">
          <div className="flex items-center gap-5">
            <ScoreRing value={ORG.health.score} label="Global" />
            <div className="min-w-0 flex-1 space-y-3">
              <ProgressRow label="Documentée" value={ORG.health.documented} tone="success" compact />
              <ProgressRow label="Vérifiée" value={ORG.health.verified} compact />
              <ProgressRow label="À jour" value={ORG.health.upToDate} tone="success" compact />
              <ProgressRow label="Partagée entre plusieurs personnes" value={ORG.health.shared} tone="warning" compact />
            </div>
          </div>
        </Card>

        {/* Needs attention */}
        <Card
          title="À traiter"
          className="lg:col-span-2"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/knowledge-risk')}>
              Tout voir
            </Button>
          }
        >
          <ul className="space-y-2.5">
            {ATTENTION_ITEMS.map((item) => {
              const Icon = severityIcon[item.severity]
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-3"
                >
                  <HugeIcon
                    icon={Icon}
                    size="md"
                    className={cx(
                      'shrink-0',
                      item.severity === 'critical' ? 'text-rose-500' : 'text-amber-500',
                    )}
                  />
                  <p className="min-w-0 flex-1 text-body-2-medium text-text-primary">{item.text}</p>
                  {item.severity === 'critical' && <CriticalBadge />}
                  <Button variant="secondary" size="xs" onClick={() => navigate(item.href)}>
                    {item.cta}
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>

        {/* Agent activity */}
        <Card
          title="Activité des agents"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/agents')}>
              {activeAgents.length} agents actifs
            </Button>
          }
        >
          <ul className="space-y-3">
            {agents.slice(0, 4).map((agent) => (
              <li key={agent.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
                  <HugeIcon
                    icon={agent.status === 'running' || agent.status === 'thinking' ? Loading03Icon : BotIcon}
                    size="xs"
                    className={cx(
                      'text-foreground-icon-secondary',
                      agent.status === 'running' && 'animate-spin [animation-duration:2.5s]',
                    )}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/agents/${agent.id}`)}
                      className="truncate text-body-2-medium text-text-primary hover:underline"
                    >
                      {agent.name}
                    </button>
                    <span className="shrink-0 text-caption-2-medium text-text-tertiary">
                      {agent.lastActivity}
                    </span>
                  </div>
                  <p className="truncate text-caption-1-medium text-text-secondary">
                    {agent.recent[0]?.detail ?? agent.description}
                  </p>
                </div>
                <AgentStatusBadge status={agent.status} />
              </li>
            ))}
          </ul>
        </Card>

        {/* Knowledge risk overview */}
        <Card
          title="Risque de savoir par rôle"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/knowledge-risk')}>
              Voir l'analyse complète
            </Button>
          }
        >
          <ul className="space-y-3">
            {riskByRole.map((r) => (
              <li key={r.role} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-body-2-medium text-text-primary">{r.role}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-body-2-semibold text-text-primary tabular-nums">{r.value} %</span>
                    <RiskBadge
                      risk={r.level === 'critical' ? 'critical' : r.level === 'moderate' ? 'moderate' : 'healthy'}
                      label={r.level === 'critical' ? 'Critique' : r.level === 'moderate' ? 'Modéré' : 'Sain'}
                    />
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
                  <div
                    className={cx(
                      'h-full rounded-full',
                      r.level === 'critical'
                        ? 'bg-rose-500'
                        : r.level === 'moderate'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500',
                    )}
                    style={{ width: `${r.value}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        {/* Handover in progress */}
        {(liveHandover || moussaHandover) && (() => {
          const hv = liveHandover
            ? { id: liveHandover.id, name: liveHandover.employee_name, role: liveHandover.role_title ?? '', readiness: liveHandover.readiness, gaps: null as number | null }
            : {
                id: moussaHandover!.id,
                name: moussaHandover!.employeeName,
                role: moussaHandover!.roleTitle,
                readiness: moussaHandover!.readiness,
                gaps: moussaHandover!.gaps.length,
              }
          return (
            <Card
              title="Transfert en cours"
              actions={
                <Button variant="ghost" size="xs" onClick={() => navigate(`/handovers/${hv.id}`)}>
                  Ouvrir
                </Button>
              }
            >
              <div className="flex items-center gap-3">
                <PersonAvatar name={hv.name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-medium text-text-primary">{hv.name}</p>
                  <p className="text-caption-1-medium text-text-secondary">{hv.role}</p>
                </div>
                <ScoreRing value={hv.readiness} size={72} tone={hv.readiness >= 90 ? 'success' : 'warning'} />
              </div>
              <p className="mt-3 text-caption-1-medium text-text-tertiary">
                {hv.gaps !== null ? `${hv.gaps} lacunes détectées · entretien en cours` : 'Analyse du poste et entretien de transfert en cours'}
              </p>
            </Card>
          )
        })()}

        {/* Pending approvals */}
        <Card
          title="Approbations en attente"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/approvals')}>
              {pending.length} en attente
            </Button>
          }
        >
          <ul className="space-y-2.5">
            {pending.slice(0, 3).map((a) => (
              <li key={a.id} className="flex items-start gap-2.5 rounded-xl border border-border-button-default p-3">
                <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-2-medium text-text-primary">{a.title}</p>
                  <p className="text-caption-1-medium text-text-tertiary">
                    {a.agentName} · {a.requestedAt}
                  </p>
                </div>
                <Button variant="secondary" size="xs" onClick={() => navigate('/approvals')}>
                  Examiner
                </Button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Recent knowledge */}
        <Card
          title="Connaissances récentes"
          className="lg:col-span-2"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/brain')}>
              Company Brain
            </Button>
          }
        >
          <ul className="space-y-1">
            {recent.map((k) => (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/brain/${k.id}`)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background-primary-hover"
                >
                  <span className="mt-0.5 shrink-0">
                    <KnowledgeTypeBadge type={k.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-2-medium text-text-primary">{k.title}</span>
                    <span className="block text-caption-1-medium text-text-tertiary">
                      {k.source} · {k.owner} · {k.updated}
                    </span>
                  </span>
                  <span className="shrink-0 text-caption-1-semibold text-text-secondary tabular-nums">
                    {k.confidence} %
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Bottom quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: 'Demander à Companion', detail: 'Interrogez la mémoire de votre entreprise.', icon: AiBrain01Icon, href: '/ask' },
          { title: 'Préparer un départ', detail: 'Lancez une analyse de transfert.', icon: Exchange01Icon, href: '/handovers/new/emp-moussa' },
          { title: 'Journal d’activité', detail: 'Qui a fait quoi, quand.', icon: Activity01Icon, href: '/activity' },
        ].map((c) => (
          <button
            key={c.title}
            type="button"
            onClick={() => navigate(c.href)}
            className="flex items-center gap-3 rounded-2xl border border-border-button-default bg-background-primary-default p-4 text-left shadow-card transition-colors hover:bg-background-primary-hover"
          >
            <HugeIcon icon={c.icon} size="md" className="shrink-0 text-foreground-icon-tertiary" />
            <span className="min-w-0">
              <span className="block text-body-medium font-medium text-text-primary">{c.title}</span>
              <span className="block truncate text-caption-1-medium text-text-secondary">{c.detail}</span>
            </span>
            <HugeIcon icon={ArrowRight02Icon} size="sm" className="ml-auto shrink-0 text-foreground-icon-quaternary" />
          </button>
        ))}
      </div>
    </div>
  )
}
