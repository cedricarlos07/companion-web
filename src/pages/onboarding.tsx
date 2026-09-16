import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ProgressRow, ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { adaptIcon } from '@/components/ui/huge-icon'
import { PlusSignIcon } from '@/lib/icons'
import { ONBOARDINGS } from '@/data/continuity'
import { api } from '@/services/api'
import { useEffect, useState } from 'react'
import { useAppStore } from '@/store/app-store'

export function OnboardingPage() {
  const navigate = useNavigate()
  const [list, setList] = useState<Record<string, unknown>[]>(ONBOARDINGS as unknown as Record<string, unknown>[])
  useEffect(() => {
    api.onboardings().then((res) => {
      if (res && res.onboardings.length > 0) setList(res.onboardings)
    })
  }, [])
  const { pushToast } = useAppStore()

  // Normalise les lignes API (snake_case + plan jsonb) vers la forme d'affichage.
  const view = list.map((raw) => {
    const o = raw as Record<string, unknown>
    const plan = (o.plan ?? {}) as Record<string, unknown>
    return {
      id: String(o.id),
      employeeName: String(o.employee_name ?? plan.employee ?? 'Employé'),
      roleTitle: String(o.role_title ?? plan.role ?? ''),
      startDate: String(plan.generatedAt ?? o.created_at ?? '').slice(0, 10),
      readiness: Number(plan.readiness ?? 0),
      progress: Number(plan.readiness ?? 0),
      builtFrom: [] as string[],
      sections: [] as unknown[],
    }
  })

  return (
    <div>
      <PageHeader
        title="Intégration"
        subtitle="Chaque nouvel arrivant démarre avec la mémoire de son rôle."
        actions={
          <Button
            leadingIcon={adaptIcon(PlusSignIcon, 20)}
            onClick={() => pushToast("Création d'onboarding — démo : parcours simulé créé.")}
          >
            Nouvel onboarding
          </Button>
        }
      />

      <div className="space-y-3">
        {view.map((o) => (
          <div
            key={String(o.id)}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
          >
            <PersonAvatar name={o.employeeName} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-body-medium font-medium text-text-primary">{o.employeeName}</p>
              <p className="text-caption-1-medium text-text-secondary">
                Nouveau {o.roleTitle} · arrive le {o.startDate}
              </p>
            </div>

            <div className="hidden w-64 md:block">
              <ProgressRow label="Préparation" value={Number(o.readiness)} tone="success" compact />
            </div>

            <ScoreRing value={Number(o.readiness)} size={64} tone="success" label="Prêt" />

            <div className="flex gap-2">
              <Button size="small" onClick={() => navigate(`/onboarding/${String(o.id)}`)}>
                Ouvrir l'onboarding
              </Button>
            </div>
          </div>
        ))}

        <Card title="Construit à partir de">
          <ul className="grid gap-2 sm:grid-cols-2">
            {ONBOARDINGS[0].builtFrom.map((b) => (
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
