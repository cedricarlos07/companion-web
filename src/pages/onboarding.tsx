import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow, ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { adaptIcon } from '@/components/ui/huge-icon'
import { PlusSignIcon } from '@/lib/icons'
import { api } from '@/services/api'

interface OnboardingListItem {
  id: string
  employee_name: string
  role_title: string | null
  created_at: string
  plan: {
    employee?: string
    role?: string
    readiness?: number
    sections?: { id: string }[]
    doneItems?: string[]
    generatedAt?: string
  }
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OnboardingListItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const res = await api.onboardings()
    if (res === null) {
      setError('Impossible de charger les onboardings — backend indisponible.')
      setRows([])
      return
    }
    setRows(res.onboardings as unknown as OnboardingListItem[])
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const progressOf = (o: OnboardingListItem): number => {
    const sections = o.plan?.sections?.length ?? 0
    const done = o.plan?.doneItems?.length ?? 0
    return sections > 0 ? Math.round((done / sections) * 100) : 0
  }

  return (
    <div>
      <PageHeader
        title="Intégration"
        subtitle="Chaque nouvel arrivant démarre avec la mémoire de son rôle."
        actions={
          <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => navigate('/people')}>
            Nouvel onboarding
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {rows === null ? (
          <Card>
            <p className="text-body-2-medium text-text-tertiary">Chargement des onboardings…</p>
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">
              Aucun onboarding en cours — créez un handover puis générez le parcours du successeur.
            </p>
          </Card>
        ) : (
          rows.map((o) => {
            const readiness = Number(o.plan?.readiness ?? 0)
            const progress = progressOf(o)
            const employeeName = o.employee_name || o.plan?.employee || 'Employé'
            return (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
              >
                <PersonAvatar name={employeeName} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-medium font-medium text-text-primary">{employeeName}</p>
                  <p className="text-caption-1-medium text-text-secondary">
                    Nouveau {o.role_title || o.plan?.role || ''} · démarré le{' '}
                    {(o.created_at ?? o.plan?.generatedAt ?? '').slice(0, 10)}
                  </p>
                </div>

                <div className="hidden w-64 md:block">
                  <ProgressRow label={`Parcours ${progress} %`} value={progress} tone="success" compact />
                </div>

                <ScoreRing value={readiness} size={64} tone="success" label="Prêt" />

                <div className="flex gap-2">
                  <Button size="small" onClick={() => navigate(`/onboarding/${o.id}`)}>
                    Ouvrir l'onboarding
                  </Button>
                </div>
              </div>
            )
          })
        )}

        <Card title="Construit à partir de">
          <ul className="grid gap-2 sm:grid-cols-2">
            {[
              'Role Brain — la mémoire validée du rôle',
              'Handover du prédécesseur — entretien et réponses',
              'Projets actifs — ce qui tourne aujourd\'hui',
              'Company Brain — les documents de l\'organisation',
            ].map((b) => (
              <li key={b} className="flex items-center gap-2.5 rounded-xl border border-border-button-default px-3.5 py-2.5">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent-100 text-caption-2-semibold text-accent-700">
                  {b[0]}
                </span>
                <span className="min-w-0 truncate text-body-2-medium text-text-primary">{b}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-caption-1-medium text-text-tertiary">
            Le parcours combine la mémoire du rôle, le handover du prédécesseur, les projets actifs et le
            Company Brain.
          </p>
        </Card>
      </div>
    </div>
  )
}
