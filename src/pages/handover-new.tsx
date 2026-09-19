import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { AgentThinkingPanel, ThinkingWarning } from '@/components/common/agent-thinking-panel'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { Exchange01Icon, SparklesIcon } from '@/lib/icons'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import type { Employee } from '@/types'

/** Étapes d'analyse affichées pendant l'appel serveur (vocabulary UI statique). */
const ANALYSIS_STEPS: { id: string; label: string }[] = [
  { id: 'profile', label: 'Lecture du profil et des mémoires du collaborateur' },
  { id: 'coverage', label: 'Analyse de couverture par type de connaissance' },
  { id: 'procedures', label: 'Détection des procédures non documentées' },
  { id: 'relations', label: 'Identification des relations à propriétaire unique' },
  { id: 'questions', label: "Génération des questions d'entretien ciblées" },
]

export function NewHandoverPage() {
  const { employeeId } = useParams()
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [employees, setEmployees] = useState<Employee[] | null>(null)
  const [selectedId, setSelectedId] = useState<string>(employeeId ?? '')
  const [done, setDone] = useState(false)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [gapCount, setGapCount] = useState<number | null>(null)
  const [uniqueKnowledge, setUniqueKnowledge] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    api.employees().then((emps) => {
      if (emps === null) {
        setError('Impossible de charger les employés — backend indisponible.')
        setEmployees([])
        return
      }
      setEmployees(emps)
      if (!employeeId && emps.length > 0) setSelectedId((s) => s || emps[0].id)
    })
  }, [employeeId])

  const employee = (employees ?? []).find((e) => e.id === selectedId)

  // L'analyse serveur est lancée une seule fois (prévention double submit).
  async function runAnalysis() {
    if (busy || !selectedId) return
    setBusy(true)
    setError(null)
    const res = await api.startHandover(selectedId)
    if (res?.handover?.id) {
      setCreatedId(res.handover.id)
      setGapCount(res.gaps ?? null)
      setUniqueKnowledge(res.uniqueKnowledge ?? null)
    } else {
      setError('La création du handover a échoué — backend indisponible ou permission insuffisante.')
    }
    setBusy(false)
    setDone(true)
  }

  if (employees !== null && !employee && !selectedId) {
    return (
      <PageHeader
        title="Aucun collaborateur actif"
        actions={<Button variant="secondary" onClick={() => navigate('/people')}>Retour</Button>}
      />
    )
  }

  const name = employee ? `${employee.firstName} ${employee.lastName}` : '…'

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={employee ? `Préparer le départ de ${employee.firstName}` : 'Préparer un départ'}
        subtitle="Companion analyse les informations nécessaires pour assurer la continuité du poste."
        breadcrumb={
          <nav className="flex items-center gap-1.5 text-caption-1-medium text-text-tertiary" aria-label="Fil d'ariane">
            <button type="button" onClick={() => navigate('/handovers')} className="rounded px-1 py-0.5 hover:bg-background-primary-hover hover:text-text-secondary">
              Transferts
            </button>
            <span aria-hidden>/</span>
            <span className="text-text-secondary">{employee ? name : 'Nouveau'}</span>
          </nav>
        }
      />

      {employees !== null && (
        <Card className="mb-4">
          <label className="mb-1 block text-body-2-medium text-text-primary" htmlFor="handover-employee">
            Collaborateur concerné
          </label>
          <select
            id="handover-employee"
            value={selectedId}
            onChange={(e) => {
              setSelectedId(e.target.value)
              setDone(false)
              setCreatedId(null)
              setGapCount(null)
              setUniqueKnowledge(null)
            }}
            className="w-full rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-2-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            <option value="">Choisir…</option>
            {employees
              .filter((e) => e.status === 'active')
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.firstName} {e.lastName} — {e.roleTitle}
                </option>
              ))}
          </select>
        </Card>
      )}

      {employee && (
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
      )}

      {employee && !done && (
        <AgentThinkingPanel steps={ANALYSIS_STEPS} intervalMs={1200} onComplete={runAnalysis} />
      )}

      {error && (
        <div role="alert" className="mt-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {done && (
        <div className="mt-4 space-y-3">
          {createdId ? (
            <>
              <ThinkingWarning label={`${gapCount ?? 0} lacunes détectées — ${uniqueKnowledge ?? '?'} connaissances uniques rattachées au poste.`} />
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
                      pushToast('Analyse de transfert créée.', 'success')
                      navigate(`/handovers/${createdId}`)
                    }}
                  >
                    Ouvrir l'analyse de transfert
                  </Button>
                  <Button variant="secondary" onClick={() => navigate(`/people/${selectedId}`)}>
                    Voir le profil
                  </Button>
                </div>
              </Card>
            </>
          ) : (
            <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
              {error ?? 'Analyse échouée.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
