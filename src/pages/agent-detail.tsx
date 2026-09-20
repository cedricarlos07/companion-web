import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { AgentStatusBadge, AutonomyBadge, autonomyDescription } from '@/components/common/badges'
import { Tabs, TabList, Tab, TabPanel } from '@/components/base/tabs/tabs'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { EmptyState } from '@/components/common/states'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  BotIcon,
  Cancel01Icon,
  PlayIcon,
  Database01Icon,
  ShieldCheckIcon,
  MoneyIcon,
  BoltIcon,
} from '@/lib/icons'
import { api, type AgentRow, type AgentRunRow, type AgentTriggerRow, type AgentCatalog } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import type { AgentRunState, AutonomyLevel } from '@/types'
import { cx } from '@/utils/cx'

const RUN_STATUS: Record<string, { label: string; cls: string }> = {
  running: { label: 'En cours', cls: 'bg-status-blue-background text-status-blue-text' },
  thinking: { label: 'Réflexion', cls: 'bg-status-blue-background text-status-blue-text' },
  waiting_approval: { label: 'Attente humaine', cls: 'bg-status-yellow-background text-status-yellow-text' },
  waiting_input: { label: 'Attente de saisie', cls: 'bg-status-yellow-background text-status-yellow-text' },
  completed: { label: 'Terminé', cls: 'bg-status-lime-background text-status-lime-text' },
  failed: { label: 'Échoué', cls: 'bg-status-rose-background text-status-rose-text' },
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}

/** Le verifier est un objet JSONB { passed, score, reasons, retryable }. */
function verifierLabel(v: AgentRunRow['verifier']): string {
  if (v == null) return ''
  const passed = typeof v === 'object' && 'passed' in v ? Boolean((v as { passed?: unknown }).passed) : null
  if (passed === true) return ' · vérifié : réussi'
  if (passed === false) return ' · vérifié : échec'
  return ' · vérifié'
}

export function AgentDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [agent, setAgent] = useState<AgentRow | null>(null)
  const [runs, setRuns] = useState<AgentRunRow[]>([])
  const [triggers, setTriggers] = useState<AgentTriggerRow[]>([])
  const [usage, setUsage] = useState<{ runs_total: number; runs_active: number; tokens_total: number } | null>(null)
  const [catalog, setCatalog] = useState<AgentCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusPending, setStatusPending] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [budgetPending, setBudgetPending] = useState(false)
  const [runPanelOpen, setRunPanelOpen] = useState(false)
  const [runSkill, setRunSkill] = useState('')
  const [runGoal, setRunGoal] = useState('')
  const [runInput, setRunInput] = useState('')
  const [runPending, setRunPending] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setError(null)
    const res = await api.agent(id)
    if (res === null) {
      // Distingue 404 (agent introuvable) d'un backend indisponible.
      const list = await api.agents()
      if (list !== null) {
        setNotFound(!list.agents.some((a) => a.id === id))
        setError(list.agents.some((a) => a.id === id) ? 'Détail indisponible — réessayez.' : null)
      } else {
        setError('Backend indisponible — impossible de charger l\'agent.')
      }
      setLoading(false)
      return
    }
    setAgent(res.agent)
    setRuns(res.runs)
    setTriggers(res.triggers)
    setUsage(res.usage)
    setBudgetDraft(String(res.agent.max_run_tokens))
    setRunSkill((s) => s || res.agent.allowed_skills[0] || '')
    setLoading(false)
  }, [id])

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    void load()
    api.agentCatalog().then((c) => setCatalog(c))
  }, [load])

  if (loading) {
    return <Card><p className="text-body-2-medium text-text-tertiary">Chargement de l'agent…</p></Card>
  }

  if (notFound || !agent) {
    return (
      <EmptyState
        title={notFound ? 'Agent introuvable.' : (error ?? 'Agent introuvable.')}
        action={<Button onClick={() => navigate('/agents')}>Retour aux agents</Button>}
      />
    )
  }

  const isPaused = agent.status === 'paused'
  const skillLabel = (skillId: string) => catalog?.skills.find((s) => s.id === skillId)?.label ?? skillId
  const toolLabel = (toolId: string) => catalog?.tools.find((t) => t.id === toolId)?.label ?? toolId

  async function toggleStatus() {
    if (statusPending) return
    const next = isPaused ? 'running' : 'paused'
    setStatusPending(true)
    const res = await api.setAgentStatus(agent!.id, next)
    setStatusPending(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    setAgent((a) => (a ? { ...a, status: next } : a))
    pushToast(isPaused ? `${agent!.name} relancé.` : `${agent!.name} mis en pause.`, isPaused ? 'success' : 'info')
  }

  async function saveBudget() {
    if (budgetPending) return
    const value = Math.floor(Number(budgetDraft))
    if (!Number.isFinite(value) || value < 1000 || value > 2_000_000) {
      pushToast('Budget invalide — entier entre 1 000 et 2 000 000.', 'error')
      return
    }
    setBudgetPending(true)
    const res = await api.setAgentLimits(agent!.id, value)
    setBudgetPending(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    setAgent((a) => (a ? { ...a, max_run_tokens: value } : a))
    pushToast('Budget par run mis à jour.', 'success')
  }

  async function startRun() {
    if (runPending || !runSkill) return
    let inputData: Record<string, unknown> | undefined
    const trimmed = runInput.trim()
    if (trimmed !== '') {
      try {
        const parsed: unknown = JSON.parse(trimmed)
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
          throw new Error('objet attendu')
        }
        inputData = parsed as Record<string, unknown>
      } catch {
        pushToast('Données du run invalides — JSON objet attendu (ex. {"client":"Orange CI"}).', 'error')
        return
      }
    }
    setRunPending(true)
    const res = await api.startAgentRun(agent!.id, {
      skill: runSkill,
      goal: runGoal.trim() || undefined,
      inputData,
    })
    setRunPending(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    pushToast(`Tâche lancée (run ${String(res.data.run?.id ?? '').slice(0, 8)}…).`, 'success')
    setRunPanelOpen(false)
    setRunGoal('')
    setRunInput('')
    void load()
  }

  async function toggleTrigger(row: AgentTriggerRow) {
    const res = await api.toggleTrigger(row.id)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    setTriggers((list) => list.map((t) => (t.id === row.id ? { ...t, enabled: !t.enabled } : t)))
  }

  return (
    <div>
      <PageHeader
        title={agent.name}
        subtitle={agent.description ?? agent.goal}
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
              <AgentStatusBadge status={agent.status as AgentRunState} />
              <AutonomyBadge autonomy={agent.autonomy as AutonomyLevel} />
            </span>
            <Button
              variant="secondary"
              leadingIcon={isPaused ? adaptIcon(PlayIcon, 20) : adaptIcon(Cancel01Icon, 20)}
              disabled={statusPending}
              onClick={() => void toggleStatus()}
            >
              {statusPending ? '…' : isPaused ? 'Reprendre' : 'Mettre en pause'}
            </Button>
            <Button
              leadingIcon={adaptIcon(PlayIcon, 20)}
              onClick={() => setRunPanelOpen((o) => !o)}
              disabled={agent.allowed_skills.length === 0}
            >
              Lancer une tâche
            </Button>
          </>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {runPanelOpen && (
        <Card title="Nouvelle tâche" className="mb-4">
          {agent.allowed_skills.length === 0 ? (
            <p className="text-body-2-regular text-text-secondary">
              Aucune compétence autorisée pour cet agent — ajoutez-en une dans sa configuration.
            </p>
          ) : (
            <div className="space-y-3">
              <label className="block space-y-1.5">
                <span className="text-caption-1-semibold text-text-secondary">Compétence à exécuter</span>
                <select
                  value={runSkill}
                  onChange={(e) => setRunSkill(e.target.value)}
                  className="w-full rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-2-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                >
                  {agent.allowed_skills.map((s) => (
                    <option key={s} value={s}>{skillLabel(s)}</option>
                  ))}
                </select>
              </label>
              <Input label="Objectif du run (optionnel)" value={runGoal} onChange={setRunGoal} placeholder="ex. Préparer la relance du client Orange CI" />
              <label className="block space-y-1.5">
                <span className="text-caption-1-semibold text-text-secondary">
                  Données du run (JSON, optionnel — ex. {"{"}"client":"Orange CI"{"}"})
                </span>
                <textarea
                  value={runInput}
                  onChange={(e) => setRunInput(e.target.value)}
                  rows={3}
                  placeholder='{"client": "Orange CI"}'
                  aria-label="Données du run au format JSON"
                  className="w-full rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 font-mono text-body-2-regular text-text-primary outline-none placeholder:text-text-placeholder focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                />
              </label>
              <div className="flex items-center gap-2">
                <Button onClick={() => void startRun()} disabled={runPending || !runSkill}>
                  {runPending ? 'Lancement…' : 'Lancer'}
                </Button>
                <Button variant="ghost" onClick={() => setRunPanelOpen(false)}>Annuler</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <Tabs defaultSelectedKey="overview">
        <TabList aria-label="Sections de l'agent">
          <Tab id="overview">Aperçu</Tab>
          <Tab id="activity">Activité</Tab>
          <Tab id="skills">Compétences</Tab>
          <Tab id="tools">Outils</Tab>
          <Tab id="memory">Mémoire</Tab>
          <Tab id="triggers">Déclencheurs</Tab>
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
                  <AutonomyBadge autonomy={agent.autonomy as AutonomyLevel} />
                  <span className="text-caption-1-medium text-text-tertiary">{autonomyDescription(agent.autonomy as AutonomyLevel)}</span>
                </p>
                <p className="mt-3 flex items-center gap-2 text-caption-1-semibold text-text-secondary">
                  <HugeIcon icon={BotIcon} size="xs" />
                  Modèle
                </p>
                <p className="mt-1 text-caption-1-medium text-text-tertiary">
                  {agent.model_provider}{agent.model ? ` · ${agent.model}` : ' · modèle par défaut'}
                </p>
              </div>
            </Card>
            <Card title="Budget &amp; consommation">
              <div className="space-y-2.5">
                <p className="text-caption-1-medium text-text-tertiary">
                  Plafond quotidien : {agent.max_daily_tokens.toLocaleString('fr-FR')} tokens
                </p>
                <p className="text-caption-1-medium text-text-tertiary">
                  Consommation totale : {(usage?.tokens_total ?? 0).toLocaleString('fr-FR')} tokens ·{' '}
                  {usage?.runs_total ?? 0} run(s) dont {usage?.runs_active ?? 0} actif(s)
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-48 flex-1">
                    <Input
                      label="Budget maximum par run (tokens)"
                      value={budgetDraft}
                      onChange={setBudgetDraft}
                    />
                  </div>
                  <Button
                    variant="secondary"
                    size="small"
                    disabled={budgetPending || Number(budgetDraft) === agent.max_run_tokens}
                    leadingIcon={adaptIcon(MoneyIcon, 18)}
                    onClick={() => void saveBudget()}
                  >
                    {budgetPending ? '…' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        </TabPanel>

        <TabPanel id="activity" className="pt-4">
          <Card>
            {runs.length === 0 ? (
              <p className="text-body-2-regular text-text-secondary">
                Aucun run — lancez une première tâche depuis l'en-tête.
              </p>
            ) : (
              <ul className="space-y-3">
                {runs.map((r) => {
                  const meta = RUN_STATUS[r.status] ?? { label: r.status, cls: 'bg-background-tertiary-default text-text-secondary' }
                  return (
                    <li key={r.id} className="flex items-start gap-3 border-b border-separator-border pb-3 last:border-b-0 last:pb-0">
                      <HugeIcon icon={BotIcon} size="sm" className="mt-0.5 shrink-0 text-foreground-icon-tertiary" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="min-w-0 text-body-2-regular text-text-primary">{r.goal}</p>
                          <span className={`rounded-md px-1.5 py-0.5 text-caption-1-medium ${meta.cls}`}>{meta.label}</span>
                        </div>
                        <p className="text-caption-1-medium text-text-tertiary">
                          {r.skill ? skillLabel(r.skill) : '—'} · {(r.prompt_tokens + r.completion_tokens).toLocaleString('fr-FR')} tokens
                          {r.estimated_cost != null && Number(r.estimated_cost) > 0 ? ` · ~${Number(r.estimated_cost).toFixed(3)} cost` : ''}
                          {verifierLabel(r.verifier)} · {fmtDate(r.created_at)}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="skills" className="pt-4">
          <Card>
            {agent.allowed_skills.length === 0 ? (
              <p className="text-body-2-regular text-text-secondary">Aucune compétence autorisée (deny par défaut).</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {agent.allowed_skills.map((s) => (
                  <li key={s} className="rounded-lg bg-background-secondary-default px-2.5 py-1.5 text-body-2-medium text-text-primary">
                    {skillLabel(s)}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="tools" className="pt-4">
          <Card>
            {agent.allowed_tools.length === 0 ? (
              <p className="text-body-2-regular text-text-secondary">Aucun outil autorisé (deny par défaut).</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {agent.allowed_tools.map((t) => (
                  <li key={t} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <HugeIcon icon={Database01Icon} size="sm" className="text-foreground-icon-tertiary" />
                    <span className="min-w-0">
                      <span className="block truncate text-body-2-medium text-text-primary">{toolLabel(t)}</span>
                      <span className="block truncate text-caption-1-medium text-text-tertiary">{t}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="memory" className="pt-4">
          <Card title="Accès à la mémoire">
            {agent.memory_scopes.length === 0 ? (
              <p className="text-body-2-regular text-text-secondary">Aucun périmètre mémoire autorisé.</p>
            ) : (
              <ul className="space-y-2">
                {agent.memory_scopes.map((m) => (
                  <li key={m} className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-body-2-medium text-text-primary">{m}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-status-lime-background px-1.5 py-1 text-caption-1-medium text-status-lime-text">
                      Autorisé
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>

        <TabPanel id="triggers" className="pt-4">
          <Card title="Déclencheurs automatiques">
            {triggers.length === 0 ? (
              <p className="text-body-2-regular text-text-secondary">
                Aucun déclencheur câblé sur cet agent — les déclencheurs sont seedés avec les agents
                système.
              </p>
            ) : (
              <ul className="space-y-2">
                {triggers.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5">
                    <HugeIcon icon={BoltIcon} size="sm" className={t.enabled ? 'text-accent-600' : 'text-foreground-icon-tertiary'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-body-2-medium text-text-primary">{t.event_type}</p>
                      <p className="text-caption-1-medium text-text-tertiary">
                        {skillLabel(t.skill)} · quota {t.rate_limit_per_hour}/h
                      </p>
                    </div>
                    <span
                      className={cx(
                        'rounded-md px-1.5 py-1 text-caption-1-medium',
                        t.enabled
                          ? 'bg-status-lime-background text-status-lime-text'
                          : 'bg-background-tertiary-default text-text-tertiary',
                      )}
                    >
                      {t.enabled ? 'Actif' : 'Désactivé'}
                    </span>
                    <Button variant="secondary" size="xs" onClick={() => void toggleTrigger(t)}>
                      {t.enabled ? 'Désactiver' : 'Activer'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabPanel>
      </Tabs>
    </div>
  )
}
