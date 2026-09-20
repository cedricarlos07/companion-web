import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { AgentStatusBadge, AutonomyBadge } from '@/components/common/badges'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { BotIcon, PlusSignIcon, ArrowRight02Icon } from '@/lib/icons'
import { api, type AgentListRow } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import type { AgentRunState, AutonomyLevel } from '@/types'

export function AgentsPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [agents, setAgents] = useState<AgentListRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await api.agents()
    if (res === null) {
      setError('Impossible de charger les agents — backend indisponible.')
      setAgents([])
      return
    }
    setAgents(res.agents)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleStatus(agent: AgentListRow) {
    if (pendingId) return
    const starting = agent.status === 'paused' || agent.status === 'idle'
    const next = starting ? 'running' : 'paused'
    setPendingId(agent.id)
    const result = await api.setAgentStatus(agent.id, next)
    setPendingId(null)
    if (!result.ok) {
      pushToast(result.error, 'error')
      return
    }
    setAgents((list) =>
      list ? list.map((a) => (a.id === agent.id ? { ...a, status: next } : a)) : list,
    )
    pushToast(
      starting ? `${agent.name} démarré.` : `${agent.name} mis en pause.`,
      starting ? 'success' : 'info',
    )
  }

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Agents qui travaillent avec la mémoire de votre entreprise."
        actions={
          <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => navigate('/agents/new')}>
            Créer un agent
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {agents === null ? (
          <Card>
            <p className="text-body-2-medium text-text-tertiary">Chargement des agents…</p>
          </Card>
        ) : agents.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">
              Aucun agent — créez le premier pour exploiter la mémoire validée.
            </p>
          </Card>
        ) : (
          agents.map((agent) => (
            <div
              key={agent.id}
              className="flex flex-col rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  className="flex min-w-0 items-center gap-2.5 text-left"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                    <HugeIcon icon={BotIcon} size="md" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-headline-medium text-text-primary hover:underline">
                      {agent.name}
                    </span>
                    <span className="block text-caption-1-medium text-text-tertiary">
                      {agent.runs_total} run(s) · {agent.runs_active} actif(s) ·{' '}
                      {agent.tokens_total.toLocaleString('fr-FR')} tokens
                    </span>
                  </span>
                </button>
                <AgentStatusBadge status={agent.status as AgentRunState} />
              </div>

              <p className="mb-3 flex-1 text-caption-1-medium text-text-secondary">
                {agent.description ?? agent.goal}
              </p>

              <div className="mb-3 flex items-center gap-2">
                <AutonomyBadge autonomy={agent.autonomy as AutonomyLevel} />
                <span className="text-caption-1-medium text-text-tertiary">
                  {agent.allowed_tools.length} outils · {agent.allowed_skills.length} compétences
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="xs"
                  className="flex-1 justify-center"
                  disabled={pendingId === agent.id}
                  onClick={() => void toggleStatus(agent)}
                >
                  {pendingId === agent.id
                    ? '…'
                    : agent.status === 'paused'
                      ? 'Reprendre'
                      : agent.status === 'idle'
                        ? 'Démarrer'
                        : 'Mettre en pause'}
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  trailingIcon={adaptIcon(ArrowRight02Icon, 14)}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                >
                  Détails
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Card className="mt-5">
        <p className="text-body-2-regular text-text-secondary">
          Chaque action d'agent est journalisée : ce que l'IA a fait, sur quelle source, avec quelle
          permission. Rien n'est exécuté en silence.
        </p>
      </Card>
    </div>
  )
}
