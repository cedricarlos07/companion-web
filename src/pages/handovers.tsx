import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { PersonAvatar } from '@/components/common/person-avatar'
import { ScoreRing } from '@/components/common/progress'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { ArrowRight02Icon, PlusSignIcon } from '@/lib/icons'
import { api } from '@/services/api'
import type { Handover, Employee } from '@/types'

const HANDOVER_STATUS: Record<string, { label: string; cls: string }> = {
  analyzing: { label: 'Analyse en cours', cls: 'bg-status-blue-background text-status-blue-text' },
  'in-progress': { label: 'En cours', cls: 'bg-status-yellow-background text-status-yellow-text' },
  interview: { label: 'Entretien en cours', cls: 'bg-status-yellow-background text-status-yellow-text' },
  gaps: { label: 'Manques détectés', cls: 'bg-status-yellow-background text-status-yellow-text' },
  ready: { label: 'Prêt', cls: 'bg-status-lime-background text-status-lime-text' },
}

export function HandoversPage() {
  const navigate = useNavigate()
  const [handovers, setHandovers] = useState<Handover[] | null>(null)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setError(null)
    const list = await api.handovers()
    if (list === null) {
      setError('Impossible de charger les transferts — backend indisponible.')
      setHandovers([])
      return
    }
    setHandovers(list)
    const emps = await api.employees()
    if (emps) setEmployees(emps)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = (handovers ?? []).filter((h) => {
    const matchSearch = search.trim() === '' || h.employeeName.toLowerCase().includes(search.trim().toLowerCase())
    const matchStatus = statusFilter === 'all' || h.status === statusFilter
    return matchSearch && matchStatus
  })

  // Recommandations réelles : employés actifs à haut risque de savoir, sans handover en cours.
  const handoverEmployeeIds = new Set((handovers ?? []).map((h) => (h as unknown as { employee_id?: string }).employee_id))
  const candidates = employees.filter(
    (e) => e.status === 'active' && (e.risk === 'critical' || e.risk === 'high') && !handoverEmployeeIds.has(e.id),
  )

  return (
    <div>
      <PageHeader
        title="Transferts"
        subtitle="Assurez la continuité de chaque poste, avant le départ."
        actions={
          <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => navigate('/handovers/new')}>
            Nouveau transfert
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un employé…"
          aria-label="Rechercher un transfert"
          className="w-64 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-2-medium text-text-primary outline-none placeholder:text-text-placeholder focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer par statut"
          className="rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2 text-body-2-medium text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
        >
          <option value="all">Tous les statuts</option>
          <option value="analyzing">Analyse en cours</option>
          <option value="gaps">Manques détectés</option>
          <option value="interview">Entretien en cours</option>
          <option value="ready">Prêt</option>
        </select>
        <span className="text-caption-1-medium text-text-tertiary tabular-nums">
          {visible.length} transfert(s)
        </span>
        <Button variant="ghost" size="xs" onClick={() => void load()}>
          Rafraîchir
        </Button>
      </div>

      <div className="space-y-3">
        {handovers === null ? (
          <Card>
            <p className="text-body-2-medium text-text-tertiary">Chargement des transferts…</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">
              {handovers.length === 0
                ? 'Aucun transfert en cours — préparez le départ d\'un collaborateur porteur de savoir.'
                : 'Aucun transfert ne correspond à la recherche.'}
            </p>
          </Card>
        ) : (
          visible.map((h) => {
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
                    {h.roleTitle} · {h.status === 'ready' ? 'pack généré' : 'transfert en cours'} · mis à jour{' '}
                    {h.updatedAt.slice(0, 10) || h.updatedAt}
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
          })
        )}

        {candidates.length > 0 && (
          <Card title="Rôles à risque — recommandations">
            <p className="mb-3 text-body-2-regular text-text-secondary">
              Ces collaborateurs portent un savoir unique. Préparer un transfert maintenant évite la perte
              sèche de connaissances.
            </p>
            <ul className="space-y-2">
              {candidates.slice(0, 5).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border-button-default px-3.5 py-2.5"
                >
                  <PersonAvatar name={`${e.firstName} ${e.lastName}`} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-2-medium text-text-primary">{e.firstName} {e.lastName}</p>
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
