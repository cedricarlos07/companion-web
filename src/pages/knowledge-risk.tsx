import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card, StatCard } from '@/components/common/stat-card'
import { ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  Alert02Icon,
  Exchange01Icon,
  FileValidationIcon,
  ShieldAlertIcon,
  TaskIcon,
  UserGroupIcon,
} from '@/lib/icons'
import { CRITICAL_DEPENDENCIES } from '@/data/org'
import { api } from '@/services/api'
import { cx } from '@/utils/cx'

interface RiskPerson {
  subjectId: string
  subjectName: string
  score: number
  level: string
  factors: { key: string; label: string; value: number; weight: number; detail: string }[]
}

function riskBarColor(value: number): string {
  if (value >= 80) return 'bg-rose-500'
  if (value >= 60) return 'bg-amber-500'
  if (value >= 35) return 'bg-amber-400'
  return 'bg-emerald-500'
}

export function KnowledgeRiskPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<{
    overall: number
    level: string
    criticalPeople: number
    criticalRoles: number
    singleOwnerProcedures: number
    employees: RiskPerson[]
  } | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.knowledgeRisk().then((res) => {
      if (res) setData(res)
    })
  }, [])

  const overall = data?.overall ?? 31
  const criticalPeople = data?.criticalPeople ?? 4
  const criticalRoles = data?.criticalRoles ?? 3
  const singleOwnerProcedures = data?.singleOwnerProcedures ?? 27
  const ranked = data?.employees?.slice(0, 6) ?? []
  const levelLabel =
    data?.level === 'critical' ? 'Critique'
    : data?.level === 'high' ? 'Élevé'
    : data?.level === 'low' ? 'Faible'
    : 'Modéré'

  return (
    <div className="space-y-5">
      <PageHeader
        title="Knowledge Risk"
        subtitle="Identifiez ce que l'entreprise risque de perdre avant qu'il ne soit trop tard."
        actions={
          <Button variant="secondary" onClick={() => navigate('/automations')}>
            Automatiser la surveillance
          </Button>
        }
      />

      {/* Overall */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-2 py-2">
            <ScoreRing
              value={overall}
              label="Risque global"
              tone={overall >= 70 ? 'critical' : overall >= 40 ? 'warning' : 'success'}
            />
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-caption-1-semibold text-amber-800">
              {levelLabel}
            </span>
            <p className="max-w-56 text-center text-caption-1-medium text-text-tertiary">
              Score explicable : single-owner 30 % · couverture 25 % · fraîcheur 15 % · diversité des
              sources 10 % · préparation du transfert 20 %.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Personnes critiques" value={String(criticalPeople)} icon={UserGroupIcon} tone="critical" />
          <StatCard label="Rôles critiques" value={String(criticalRoles)} icon={ShieldAlertIcon} tone="critical" />
          <StatCard
            label="Procédures à propriétaire unique"
            value={String(singleOwnerProcedures)}
            icon={FileValidationIcon}
            tone="critical"
          />
          <StatCard label="Tâches récurrentes non documentées" value="14" icon={TaskIcon} tone="critical" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk by person — ranked, expluable, données réelles */}
        <Card title={data ? 'Risque par personne' : 'Risque par rôle'}>
          {ranked.length === 0 ? (
            <p className="py-6 text-center text-body-2-regular text-text-tertiary">
              Calcul du risque en cours…
            </p>
          ) : (
            <ul className="space-y-4">
              {ranked.map((r, i) => (
                <li key={r.subjectId} className="space-y-1.5">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 text-left"
                    onClick={() => setExpanded(expanded === r.subjectId ? null : r.subjectId)}
                    aria-expanded={expanded === r.subjectId}
                  >
                    <span className="flex items-center gap-2 text-body-2-medium text-text-primary">
                      <span className="text-caption-1-semibold text-text-tertiary tabular-nums">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      {r.subjectName}
                      {r.score >= 60 && <HugeIcon icon={Alert02Icon} size="xs" className="text-rose-500" />}
                    </span>
                    <span className="text-body-2-semibold text-text-primary tabular-nums">{r.score} %</span>
                  </button>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpanded(expanded === r.subjectId ? null : r.subjectId)}
                    onKeyDown={(e) => e.key === 'Enter' && setExpanded(expanded === r.subjectId ? null : r.subjectId)}
                    className="h-2 cursor-pointer overflow-hidden rounded-full bg-background-tertiary-default"
                  >
                    <div
                      className={cx('h-full rounded-full transition-[width] duration-700', riskBarColor(r.score))}
                      style={{ width: `${r.score}%` }}
                    />
                  </div>
                  {expanded === r.subjectId && (
                    <div className="mt-2 space-y-1.5 rounded-xl bg-background-secondary-default p-3">
                      <p className="text-caption-1-semibold text-text-secondary">Décomposition du score</p>
                      <ul>
                        {r.factors.map((f) => (
                          <li key={f.key} className="flex items-start justify-between gap-3 py-1 text-caption-1-regular">
                            <span className="min-w-0 text-text-secondary">
                              <span className="font-medium text-text-primary">{f.label}</span> (poids {f.weight} %)
                              — {f.detail}
                            </span>
                            <span className="shrink-0 text-body-2-semibold text-text-primary tabular-nums">
                              {f.value} %
                            </span>
                          </li>
                        ))}
                      </ul>
                      <Button size="xs" variant="secondary" onClick={() => navigate(`/people/${r.subjectId}`)}>
                        Voir le profil
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Critical dependencies */}
        <Card title="Dépendances critiques">
          <ul className="space-y-2.5">
            {CRITICAL_DEPENDENCIES.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-3"
              >
                <HugeIcon
                  icon={d.id === 'dep-clients' ? Exchange01Icon : Alert02Icon}
                  size="md"
                  className="shrink-0 text-rose-500"
                />
                <p className="min-w-0 flex-1 text-body-2-medium text-text-primary">{d.text}</p>
                <Button
                  variant="secondary"
                  size="xs"
                  onClick={() =>
                    d.href.startsWith('/people')
                      ? navigate(d.href)
                      : d.id === 'dep-tasks'
                        ? navigate('/handovers/new/emp-moussa')
                        : navigate('/knowledge-risk')
                  }
                >
                  Résoudre
                </Button>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-xl bg-background-secondary-default p-3.5">
            <p className="text-caption-1-medium text-text-secondary">
              Recommandation : lancez un entretien de connaissances avec les personnes critiques. Companion
              transformera leurs réponses en procédures vérifiées.
            </p>
            <Button size="xs" className="mt-2" onClick={() => navigate('/handovers/new/emp-moussa')}>
              Préparer le départ de Moussa
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
