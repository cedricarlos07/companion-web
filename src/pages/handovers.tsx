import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { ArrowRight02Icon, PlusSignIcon } from '@/lib/icons'
import { HANDOVERS } from '@/data/continuity'
import { EMPLOYEES, fullName } from '@/data/employees'
import { api } from '@/services/api'
import type { Handover } from '@/types'

const HANDOVER_STATUS: Record<string, { label: string; cls: string }> = {
  analyzing: { label: 'Analyse en cours', cls: 'bg-status-blue-background text-status-blue-text' },
  'in-progress': { label: 'En cours', cls: 'bg-status-yellow-background text-status-yellow-text' },
  interview: { label: 'Entretien en cours', cls: 'bg-status-yellow-background text-status-yellow-text' },
  gaps: { label: 'Manques détectés', cls: 'bg-status-yellow-background text-status-yellow-text' },
  ready: { label: 'Prêt', cls: 'bg-status-lime-background text-status-lime-text' },
}

export function HandoversPage() {
  const navigate = useNavigate()
  const [handovers, setHandovers] = useState<Handover[]>(HANDOVERS)

  useEffect(() => {
    api.handovers().then((real) => {
      if (real && real.length > 0) setHandovers(real)
    })
  }, [])

  const candidates = EMPLOYEES.filter((e) => e.status === 'active' && (e.risk === 'critical' || e.risk === 'high'))

  return (
    <div>
      <PageHeader
        title="Transferts"
        subtitle="Assurez la continuité de chaque poste, avant le départ."
        actions={
          <Button
            leadingIcon={adaptIcon(PlusSignIcon, 20)}
            onClick={() => navigate('/handovers/new/emp-moussa')}
          >
            Nouveau transfert
          </Button>
        }
      />

      <div className="space-y-3">
        {handovers.map((h) => {
          const meta = HANDOVER_STATUS[h.status] ?? HANDOVER_STATUS.analyzing
          return (
            <div
              key={h.id}
              className="flex flex-wrap items-center gap-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card"
            >
              <PersonAvatar name={h.employeeName} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-body-medium font-medium text-text-primary">{h.employeeName}</p>
                  <span className={`rounded-md px-1.5 py-0.5 text-caption-1-medium ${meta.cls}`}>{meta.label}</span>
                </div>
                <p className="text-caption-1-medium text-text-secondary">
                  {h.roleTitle} · {h.status === 'ready' ? 'pack généré' : 'transfert en cours'} · mis à jour {h.updatedAt.slice(0, 10) || h.updatedAt}
                </p>
              </div>
              <ScoreRing value={h.readiness} size={64} tone={h.readiness >= 90 ? 'success' : 'warning'} />
              <div className="flex gap-2">
                <Button variant="secondary" size="small" onClick={() => navigate(`/handovers/${h.id}/interview`)}>
                  Poursuivre l'entretien
                </Button>
                <Button size="small" onClick={() => navigate(`/handovers/${h.id}`)}>
                  Ouvrir le handover
                </Button>
              </div>
            </div>
          )
        })}

        {candidates.length > 0 && (
          <Card title="Rôles à risque — recommandations">
            <p className="mb-3 text-body-2-regular text-text-secondary">
              Ces collaborateurs portent un savoir unique. Préparer un transfert maintenant évite la perte
              sèche de connaissances.
            </p>
            <ul className="space-y-2">
              {candidates.map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5"
                >
                  <PersonAvatar name={fullName(e)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-2-medium text-text-primary">{fullName(e)}</p>
                    <p className="text-caption-1-medium text-text-tertiary">
                      {e.roleTitle} · {e.uniqueKnowledge} connaissances uniques · couverture {e.coverage} %
                    </p>
                  </div>
                  <Button variant="secondary" size="xs" onClick={() => navigate(`/handovers/new/${e.id}`)}>
                    Préparer le départ
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="flex items-center gap-2.5 rounded-xl bg-background-secondary-default px-4 py-3 text-caption-1-medium text-text-secondary">
          <HugeIcon icon={ArrowRight02Icon} size="xs" className="shrink-0 text-accent-500" />
          Flux : analyse du poste → détection des lacunes → entretien → validation → pack de handover →
          Role Brain → onboarding du successeur.
        </div>
      </div>
    </div>
  )
}
