import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HugeIcon } from '@/components/ui/huge-icon'
import { Card, StatCard } from '@/components/common/stat-card'
import { ScoreRing } from '@/components/common/progress'
import { PersonAvatar } from '@/components/common/person-avatar'
import { KnowledgeTypeBadge, RiskBadge, AgentStatusBadge } from '@/components/common/badges'
import {
  AiBrain01Icon,
  Alert02Icon,
  AlertCircleIcon,
  ArrowRight02Icon,
  BotIcon,
  CheckmarkCircle02Icon,
  Exchange01Icon,
  HierarchyIcon,
  Loading03Icon,
  ShieldAlertIcon,
  Activity01Icon,
} from '@/lib/icons'
import { api, type AgentListRow } from '@/services/api'
import { Button } from '@/components/base/buttons/button'
import { cx } from '@/utils/cx'
import { formatNumber } from '@/lib/format'
import type { KnowledgeType, AgentRunState } from '@/types'

interface AttentionItem {
  id: string
  severity: 'critical' | 'warning'
  text: string
  href: string
  cta: string
}

const severityIcon = {
  critical: AlertCircleIcon,
  warning: Alert02Icon,
} as const

export function HomePage() {
  const navigate = useNavigate()
  const [me, setMe] = useState<{ name: string; org_name?: string } | null>(null)
  const [overview, setOverview] = useState<NonNullable<Awaited<ReturnType<typeof api.overview>>> | null>(null)
  const [risk, setRisk] = useState<NonNullable<Awaited<ReturnType<typeof api.knowledgeRisk>>> | null>(null)
  const [agents, setAgents] = useState<AgentListRow[]>([])
  const [pending, setPending] = useState<{ id: string; action: string; agent_name: string | null; requested_at: string }[]>([])
  const [contradicted, setContradicted] = useState<{ id: string; title: string; type: string; confidence: number; contributor: string | null; updated_at?: string }[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.me().then((res) => setMe(res?.user ?? null))
    api.overview().then((o) => {
      if (!o) setError('Vue d\'ensemble indisponible — backend injoignable.')
      else setOverview(o)
    })
    api.knowledgeRisk().then((r) => setRisk(r))
    api.agents().then((res) => {
      if (res) setAgents(res.agents)
    })
    api.request<{ approvals: { id: string; action: string; agent_name: string | null; requested_at: string }[] }>('/approvals?status=pending').then((res) => {
      if (res) setPending(res.approvals)
    })
    api.request<{ memories: { id: string; title: string; type: string; confidence: number; contributor: string | null; updated_at?: string }[] }>('/memories?status=contradicted').then((res) => {
      if (res) setContradicted(res.memories)
    })
  }, [])

  const stats = overview?.stats ?? null
  const latestHandover = overview?.handovers?.[0]

  // « À traiter » — construit sur les données réelles uniquement.
  const attention: AttentionItem[] = []
  if (pending.length > 0) {
    attention.push({
      id: 'approvals', severity: 'critical',
      text: `${pending.length} approbation(s) en attente — un agent est bloqué en attente de décision.`,
      href: '/approvals', cta: 'Examiner',
    })
  }
  if (contradicted.length > 0) {
    attention.push({
      id: 'contradictions', severity: 'warning',
      text: `${contradicted.length} connaissance(s) contradictoires à arbitrer.`,
      href: '/brain?status=contradicted', cta: 'Arbitrer',
    })
  }
  if (risk && risk.criticalPeople > 0) {
    attention.push({
      id: 'risk', severity: 'critical',
      text: `${risk.criticalPeople} personne(s) critiques — savoir unique non partagé.`,
      href: '/knowledge-risk', cta: 'Analyser',
    })
  }
  if (risk && risk.singleOwnerProcedures > 0) {
    attention.push({
      id: 'single-owner', severity: 'warning',
      text: `${risk.singleOwnerProcedures} procédure(s) détenues par une seule personne.`,
      href: '/knowledge-risk', cta: 'Détail',
    })
  }

  const loading = overview === null && error === null

  return (
    <div className="space-y-5">
      {/* Greeting */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title-1-medium text-text-primary">Bonjour {me?.name?.split(' ')[0] ?? '—'}</h1>
          <p className="mt-1 text-body-medium text-text-secondary">
            Voici ce que votre organisation sait, apprend et risque d'oublier.
          </p>
        </div>
        {stats && (
          <p className="text-caption-1-medium text-text-tertiary">
            {stats.employees} employés · {stats.roles} rôles · {me?.org_name ?? ''}
          </p>
        )}
      </header>

      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {/* Executive stats */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard
          label="Connaissances"
          value={stats ? formatNumber(stats.memories) : '…'}
          icon={AiBrain01Icon}
          onClick={() => navigate('/brain')}
        />
        <StatCard
          label="Risque de savoir"
          value={risk ? `${risk.overall} / 100` : '…'}
          icon={ShieldAlertIcon}
          hint={risk ? `Niveau ${risk.level}` : undefined}
          tone={risk && risk.level === 'critical' ? 'critical' : undefined}
          onClick={() => navigate('/knowledge-risk')}
        />
        <StatCard
          label="Rôles actifs"
          value={stats ? formatNumber(stats.roles) : '…'}
          icon={HierarchyIcon}
          onClick={() => navigate('/roles')}
        />
        <StatCard
          label="Transferts"
          value={stats ? String(stats.handovers) : '…'}
          icon={Exchange01Icon}
          onClick={() => navigate('/handovers')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
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
          {loading ? (
            <p className="text-body-2-medium text-text-tertiary">Chargement des signalements…</p>
          ) : attention.length === 0 ? (
            <p className="text-body-2-medium text-text-secondary">
              Rien à signaler — aucune contradiction, aucune approbation en attente.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {attention.map((item) => {
                const Icon = severityIcon[item.severity]
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-3"
                  >
                    <HugeIcon
                      icon={Icon}
                      size="md"
                      className={cx('shrink-0', item.severity === 'critical' ? 'text-rose-500' : 'text-amber-500')}
                    />
                    <p className="min-w-0 flex-1 text-body-2-medium text-text-primary">{item.text}</p>
                    <Button variant="secondary" size="xs" onClick={() => navigate(item.href)}>
                      {item.cta}
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>

        {/* Agent activity */}
        <Card
          title="Activité des agents"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/agents')}>
              {agents.length} agents
            </Button>
          }
        >
          <ul className="space-y-3">
            {agents.slice(0, 4).map((agent) => (
              <li key={agent.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-background-secondary-default">
                  <HugeIcon
                    icon={agent.status === 'running' ? Loading03Icon : BotIcon}
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
                      {agent.runs_total} runs
                    </span>
                  </div>
                  <p className="truncate text-caption-1-medium text-text-secondary">
                    {agent.description ?? agent.goal}
                  </p>
                </div>
                <AgentStatusBadge status={agent.status as AgentRunState} />
              </li>
            ))}
            {agents.length === 0 && (
              <li className="text-body-2-medium text-text-secondary">Aucun agent actif.</li>
            )}
          </ul>
        </Card>

        {/* Knowledge risk overview */}
        <Card
          title="Risque de savoir"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/knowledge-risk')}>
              Voir l'analyse complète
            </Button>
          }
        >
          {risk === null ? (
            <p className="text-body-2-medium text-text-tertiary">Chargement du risque…</p>
          ) : (
            <ul className="space-y-3">
              {overview?.risk.topEmployees.slice(0, 5).map((e) => (
                <li key={e.name} className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-body-2-medium text-text-primary">{e.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-body-2-semibold text-text-primary tabular-nums">{e.score}</span>
                      <RiskBadge
                        risk={e.level === 'critical' || e.level === 'high' ? 'critical' : e.level === 'moderate' ? 'moderate' : 'healthy'}
                        label={e.level === 'critical' || e.level === 'high' ? 'Critique' : e.level === 'moderate' ? 'Modéré' : 'Sain'}
                      />
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-background-tertiary-default">
                    <div
                      className={cx(
                        'h-full rounded-full',
                        e.level === 'critical' || e.level === 'high'
                          ? 'bg-rose-500'
                          : e.level === 'moderate'
                            ? 'bg-amber-400'
                            : 'bg-emerald-500',
                      )}
                      style={{ width: `${Math.min(100, e.score)}%` }}
                    />
                  </div>
                </li>
              ))}
              {overview?.risk.topEmployees.length === 0 && (
                <li className="text-body-2-medium text-text-secondary">Aucun risque identifié.</li>
              )}
            </ul>
          )}
        </Card>

        {/* Handover in progress */}
        {latestHandover && (
          <Card
            title="Transfert en cours"
            actions={
              <Button variant="ghost" size="xs" onClick={() => navigate(`/handovers/${String(latestHandover.id)}`)}>
                Ouvrir
              </Button>
            }
          >
            <div className="flex items-center gap-3">
              <PersonAvatar name={String(latestHandover.employee_name ?? '—')} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-medium text-text-primary">{String(latestHandover.employee_name ?? '—')}</p>
                <p className="text-caption-1-medium text-text-secondary">
                  {String(latestHandover.role_title ?? '')}
                </p>
              </div>
              <ScoreRing
                value={Number(latestHandover.readiness ?? 0)}
                size={72}
                tone={Number(latestHandover.readiness ?? 0) >= 90 ? 'success' : 'warning'}
              />
            </div>
            <p className="mt-3 text-caption-1-medium text-text-tertiary">
              Analyse du poste et entretien de transfert en cours
            </p>
          </Card>
        )}

        {/* Pending approvals */}
        <Card
          title="Approbations en attente"
          actions={
            <Button variant="ghost" size="xs" onClick={() => navigate('/approvals')}>
              {pending.length} en attente
            </Button>
          }
        >
          {pending.length === 0 ? (
            <p className="text-body-2-medium text-text-secondary">Aucune approbation en attente.</p>
          ) : (
            <ul className="space-y-2.5">
              {pending.slice(0, 3).map((a) => (
                <li key={a.id} className="flex items-start gap-2.5 rounded-xl border border-border-button-default p-3">
                  <HugeIcon icon={CheckmarkCircle02Icon} size="sm" className="mt-0.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-2-medium text-text-primary">{a.action}</p>
                    <p className="text-caption-1-medium text-text-tertiary">
                      {a.agent_name ?? 'Agent'} · {a.requested_at?.slice(0, 16).replace('T', ' ') ?? ''}
                    </p>
                  </div>
                  <Button variant="secondary" size="xs" onClick={() => navigate('/approvals')}>
                    Examiner
                  </Button>
                </li>
              ))}
            </ul>
          )}
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
            {(overview?.recentMemories ?? []).map((m) => (
              <li key={String(m.id)}>
                <button
                  type="button"
                  onClick={() => navigate(`/brain/${String(m.id)}`)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background-primary-hover"
                >
                  <span className="mt-0.5 shrink-0">
                    <KnowledgeTypeBadge type={String(m.type) as KnowledgeType} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body-2-medium text-text-primary">{String(m.title)}</span>
                    <span className="block text-caption-1-medium text-text-tertiary">
                      {String(m.contributor ?? '—')} · {String(m.updated_at ?? '').slice(0, 10)}
                    </span>
                  </span>
                  <span className="shrink-0 text-caption-1-semibold text-text-secondary tabular-nums">
                    {Number(m.confidence ?? 0)} %
                  </span>
                </button>
              </li>
            ))}
            {overview && overview.recentMemories.length === 0 && (
              <li className="py-2 text-body-2-medium text-text-secondary">Aucune connaissance encore extraite.</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Bottom quick links */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { title: 'Demander à Companion', detail: 'Interrogez la mémoire de votre entreprise.', icon: AiBrain01Icon, href: '/ask' },
          { title: 'Préparer un départ', detail: 'Lancez une analyse de transfert.', icon: Exchange01Icon, href: '/handovers/new' },
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
