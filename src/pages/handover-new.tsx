import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { AgentThinkingPanel, ThinkingWarning } from '@/components/common/agent-thinking-panel'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { Exchange01Icon, SparklesIcon } from '@/lib/icons'
import { HANDOVER_ANALYSIS_STEPS } from '@/data/continuity'
import { getEmployee, fullName } from '@/data/employees'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'

/** Live handover analysis — mock agent run over the departing employee's role. */
export function NewHandoverPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const employee = employeeId ? getEmployee(employeeId) : undefined
  const [done, setDone] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [gapCount, setGapCount] = useState<number | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // À la fin de l'animation, lance la vraie analyse côté serveur.
  async function runAnalysis() {
    const res = await api.startHandover(employeeId ?? '')
    if (res?.handover?.id) {
      setCreatedId(res.handover.id)
      setGapCount(res.gaps)
    }
    setDone(true)
  }

  if (!employee) {
    return (
      <PageHeader
        title="Collaborateur introuvable"
        actions={<Button variant="secondary" onClick={() => navigate('/people')}>Retour</Button>}
      />
    )
  }

  const name = fullName(employee)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={`Préparer le départ de ${employee.firstName}`}
        subtitle="Companion analyse les informations nécessaires pour assurer la continuité du poste."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate('/handovers')} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Transferts
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{name}</span>
          </nav>
        }
      />

      <div className="mb-4 flex items-center gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card">
        <PersonAvatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-headline-medium text-text-primary">{name}</p>
          <p className="text-body-2-regular text-text-secondary">
            {employee.roleTitle} · {employee.department} · {employee.memories.toLocaleString('fr-FR')} connaissances
            capturées · {employee.uniqueKnowledge} uniques
          </p>
        </div>
      </div>

      <AgentThinkingPanel
        steps={HANDOVER_ANALYSIS_STEPS}
        intervalMs={1200}
        onComplete={runAnalysis}
      />

      {done && (
        <div className="mt-4 space-y-3">
          <ThinkingWarning label="18 éléments de connaissance dépendent principalement de Moussa — dont 2 critiques." />
          <ThinkingWarning label={`${gapCount ?? 6} lacunes détectées : procédures manquantes et informations contradictoires.`} />
          <Card>
            <div className="flex items-start gap-3">
              <HugeIcon icon={SparklesIcon} size="md" className="mt-0.5 shrink-0 text-accent-500" />
              <div className="min-w-0">
                <p className="text-body-medium font-medium text-text-primary">Analyse terminée</p>
                <p className="mt-0.5 text-body-2-regular text-text-secondary">
                  Le Handover Agent a construit une première cartographie du poste. Lancez l'entretien de
                  connaissances pour combler les lacunes détectées.
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                leadingIcon={adaptIcon(Exchange01Icon, 20)}
                onClick={() => {
                  pushToast('Analyse de transfert créée.')
                  navigate(createdId ? `/handovers/${createdId}` : `/handovers/hov-${employee.id.replace('emp-', '')}`)
                }}
              >
                Ouvrir l'analyse de transfert
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/people/${employee.id}`)}>
                Voir le profil
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
