import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import {
  ArrowRight02Icon,
  BotIcon,
  BoltIcon,
  RefreshIcon,
  WorkflowIcon,
} from '@/lib/icons'
import { api, type AgentTriggerRow } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { cx } from '@/utils/cx'

const EVENT_LABELS: Record<string, string> = {
  'employee.leaving': "Le statut d'un employé devient « En départ »",
  'employee.created': 'Un nouvel employé arrive',
  'memory.contradicted': 'Une contradiction est détectée dans la mémoire',
  'knowledge_risk.high': 'Le risque de connaissance dépasse le seuil',
  'source.ingested': 'Une nouvelle source est importée',
}

const SKILL_LABELS: Record<string, string> = {
  handover_employee: 'Démarrer le Handover Agent',
  interview_employee: "Conduire l'entretien de départ",
  onboard_employee: "Générer le parcours d'intégration",
  resolve_contradiction: 'Résoudre la contradiction',
  capture_knowledge: 'Capturer la connaissance',
  draft_followup: 'Préparer la relance',
  research_customer: 'Rechercher le contexte client',
  prepare_meeting: 'Préparer la réunion',
}

export function AutomationsPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [triggers, setTriggers] = useState<AgentTriggerRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await api.triggers()
    if (res === null) {
      setError('Déclencheurs indisponibles — backend injoignable.')
      setTriggers([])
      return
    }
    setTriggers(res.triggers)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggle(t: AgentTriggerRow) {
    if (pendingId) return
    setPendingId(t.id)
    const res = await api.toggleTrigger(t.id)
    setPendingId(null)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    setTriggers((list) => (list ? list.map((x) => (x.id === t.id ? { ...x, enabled: !x.enabled } : x)) : list))
    pushToast(t.enabled ? `${t.event_type} désactivé.` : `${t.event_type} activé.`, t.enabled ? 'info' : 'success')
  }

  return (
    <div>
      <PageHeader
        title="Automatisations"
        subtitle="Définissez quand Companion doit agir."
        actions={
          <Button variant="secondary" leadingIcon={adaptIcon(RefreshIcon, 20)} onClick={() => void load()}>
            Rafraîchir
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {triggers === null ? (
          <Card>
            <p className="text-body-2-medium text-text-tertiary">Chargement des déclencheurs…</p>
          </Card>
        ) : triggers.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">
              Aucun déclencheur — les agents système en embarquent au provisionnement.
            </p>
          </Card>
        ) : (
          triggers.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-1.5 rounded-lg bg-background-secondary-default px-2 py-1 text-caption-1-semibold uppercase text-text-secondary">
                  <HugeIcon icon={BoltIcon} size="xs" />
                  Quand
                </span>
                <span className="text-body-2-medium text-text-primary">
                  {EVENT_LABELS[t.event_type] ?? t.event_type}
                </span>
                <span className="text-caption-1-medium text-text-tertiary">{t.event_type}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                <span className="flex items-center gap-1.5 rounded-lg bg-accent-50 px-2 py-1 text-caption-1-semibold uppercase text-accent-700">
                  <HugeIcon icon={ArrowRight02Icon} size="xs" />
                  Alors
                </span>
                <span className="text-body-2-medium text-text-primary">
                  {SKILL_LABELS[t.skill] ?? t.skill}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/agents')}
                  className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary hover:text-text-secondary"
                >
                  <HugeIcon icon={BotIcon} size="xs" />
                  {t.agent_key}
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-separator-border pt-3">
                <p className="text-caption-1-medium text-text-tertiary">
                  Quota anti-tempête : {t.rate_limit_per_hour} exécution(s) / heure maximum
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={cx(
                      'rounded-md px-1.5 py-1 text-caption-1-medium',
                      t.enabled
                        ? 'bg-status-lime-background text-status-lime-text'
                        : 'bg-background-tertiary-default text-text-secondary',
                    )}
                  >
                    {t.enabled ? 'Active' : 'En pause'}
                  </span>
                  <Button
                    variant="secondary"
                    size="xs"
                    disabled={pendingId === t.id}
                    onClick={() => void toggle(t)}
                  >
                    {pendingId === t.id ? '…' : t.enabled ? 'Mettre en pause' : 'Activer'}
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Card className="mt-5">
        <div className="flex items-start gap-3">
          <HugeIcon icon={WorkflowIcon} size="md" className="mt-0.5 shrink-0 text-accent-500" />
          <p className="text-body-2-regular text-text-secondary">
            V1 : chaque déclencheur lance le workflow d'un agent (validation humaine incluse selon le
            risque). Les scénarios multi-étapes passeront par les agents eux-mêmes, pas par un graphique
            de nœuds.
          </p>
        </div>
      </Card>
    </div>
  )
}
