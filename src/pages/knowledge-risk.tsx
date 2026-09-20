import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card, StatCard } from '@/components/common/stat-card'
import { ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon } from '@/components/ui/huge-icon'
import {
  Alert02Icon,
  HierarchyIcon,
  ShieldAlertIcon,
  FileValidationIcon,
  UserGroupIcon,
} from '@/lib/icons'
import { api } from '@/services/api'
import { cx } from '@/utils/cx'

interface RiskRole {
  subjectId: string
  subjectName: string
  score: number
  level: string
}

function riskBarColor(value: number): string {
  if (value >= 80) return 'bg-rose-500'
  if (value >= 60) return 'bg-amber-500'
  if (value >= 35) return 'bg-amber-400'
  return 'bg-emerald-500'
}

export function KnowledgeRiskPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<NonNullable<Awaited<ReturnType<typeof api.knowledgeRisk>>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.knowledgeRisk().then((res) => {
      if (res === null) setError('Analyse de risque indisponible — backend injoignable.')
      else setData(res)
    })
  }, [])

  const ranked = (data?.employees ?? []).slice(0, 6)
  const criticalRoles = (data?.roles ?? []).filter((r: RiskRole) => r.level === 'critical' || r.level === 'high').slice(0, 4)
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

      {error && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {/* Overall */}
      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Card>
          <div className="flex flex-col items-center gap-2 py-2">
            <ScoreRing
              value={data?.overall ?? 0}
              label="Risque global"
              tone={(data?.overall ?? 0) >= 70 ? 'critical' : (data?.overall ?? 0) >= 40 ? 'warning' : 'success'}
            />
            {data && (
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-caption-1-semibold text-amber-800">
                {levelLabel}
              </span>
            )}
            <p className="max-w-56 text-center text-caption-1-medium text-text-tertiary">
              Score explicable : single-owner 30 % · couverture 25 % · fraîcheur 15 % · diversité des
              sources 10 % · préparation du transfert 20 %.
            </p>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatCard label="Personnes critiques" value={data ? String(data.criticalPeople) : '…'} icon={UserGroupIcon} tone="critical" />
          <StatCard label="Rôles critiques" value={data ? String(data.criticalRoles) : '…'} icon={ShieldAlertIcon} tone="critical" />
          <StatCard
            label="Procédures à propriétaire unique"
            value={data ? String(data.singleOwnerProcedures) : '…'}
            icon={FileValidationIcon}
            tone="critical"
          />
          <StatCard label="Personnes suivies" value={data ? String(data.employees.length) : '…'} icon={UserGroupIcon} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Risk by person — ranked, explicable, données réelles */}
        <Card title="Risque par personne">
          {data === null && !error ? (
            <p className="py-6 text-center text-body-2-regular text-text-tertiary">
              Calcul du risque en cours…
            </p>
          ) : ranked.length === 0 ? (
            <p className="py-6 text-center text-body-2-regular text-text-secondary">
              Aucun employé suivi — importez des sources pour construire la mémoire.
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

        {/* Critical dependencies — rôles critiques réels */}
        <Card title="Dépendances critiques">
          {criticalRoles.length === 0 ? (
            <p className="py-6 text-center text-body-2-regular text-text-secondary">
              Aucun rôle critique détecté.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {criticalRoles.map((r) => (
                <li
                  key={r.subjectId}
                  className="flex items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-3"
                >
                  <HugeIcon icon={HierarchyIcon} size="md" className="shrink-0 text-rose-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-2-medium text-text-primary">{r.subjectName}</p>
                    <p className="text-caption-1-medium text-text-tertiary">Rôle · risque {r.score} %</p>
                  </div>
                  <Button variant="secondary" size="xs" onClick={() => navigate(`/roles/${r.subjectId}`)}>
                    Résoudre
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-xl bg-background-secondary-default p-3.5">
            <p className="text-caption-1-medium text-text-secondary">
              Recommandation : lancez un entretien de connaissances avec les personnes critiques. Companion
              transformera leurs réponses en procédures vérifiées.
            </p>
            <Button size="xs" className="mt-2" onClick={() => navigate('/handovers/new')}>
              Préparer un transfert
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
