import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { PersonAvatar } from '@/components/common/person-avatar'
import { RiskBadge } from '@/components/common/badges'
import { EmptyState } from '@/components/common/states'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { adaptIcon } from '@/components/ui/huge-icon'
import { UserAdd01Icon, Search01Icon } from '@/lib/icons'
import { EMPLOYEES, fullName } from '@/data/employees'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import type { Employee, EmployeeStatus, RiskLevel } from '@/types'

const STATUS_LABELS: Record<
  EmployeeStatus,
  { label: string; cls: string }
> = {
  active: { label: 'Actif', cls: 'bg-status-lime-background text-status-lime-text' },
  leaving: { label: 'En départ', cls: 'bg-status-rose-background text-status-rose-text' },
  onboarding: { label: 'Arrivant', cls: 'bg-status-blue-background text-status-blue-text' },
  former: { label: 'Ancien', cls: 'bg-background-tertiary-default text-text-secondary' },
}

const RISKS: (RiskLevel | 'all')[] = ['all', 'critical', 'high', 'moderate', 'low', 'healthy']

const RISK_LABELS: Record<RiskLevel | 'all', string> = {
  all: 'Tous les risques',
  critical: 'Critique',
  high: 'Élevé',
  moderate: 'Modéré',
  low: 'Faible',
  healthy: 'Sain',
}

export function PeoplePage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [allEmployees, setAllEmployees] = useState<Employee[]>(EMPLOYEES)
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState('all')
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all')
  const [status, setStatus] = useState<EmployeeStatus | 'all'>('all')

  // Données réelles quand le backend répond — fallback mock sinon.
  useEffect(() => {
    api.employees().then((real) => {
      if (real && real.length > 0) setAllEmployees(real)
    })
  }, [])

  const departments = useMemo(() => [...new Set(allEmployees.map((e) => e.department))], [allEmployees])

  const deptItems = [{ id: 'all', label: 'Tous les départements' }, ...departments.map((d) => ({ id: d, label: d }))]
  const riskItems = RISKS.map((r) => ({ id: r, label: RISK_LABELS[r] }))
  const statusItems = [
    { id: 'all', label: 'Tous les statuts' },
    ...(Object.keys(STATUS_LABELS) as EmployeeStatus[]).map((s) => ({
      id: s,
      label: STATUS_LABELS[s].label,
    })),
  ]
  const deptCurrent = deptItems.find((i) => i.id === dept)
  const riskCurrent = riskItems.find((i) => i.id === risk)
  const statusCurrent = statusItems.find((i) => i.id === status)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allEmployees.filter((e) => {
      if (dept !== 'all' && e.department !== dept) return false
      if (risk !== 'all' && e.risk !== risk) return false
      if (status !== 'all' && e.status !== status) return false
      if (q && !`${fullName(e)} ${e.roleTitle}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [query, dept, risk, status])

  return (
    <div>
      <PageHeader
        title="Personnes"
        subtitle="Le savoir de chaque collaborateur, capturé et exploitable."
        actions={
          <Button
            leadingIcon={adaptIcon(UserAdd01Icon, 20)}
            onClick={() => pushToast("Formulaire d'ajout — démo : employé simulé ajouté.")}
          >
            Ajouter un employé
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          placeholder="Rechercher une personne…"
          value={query}
          onChange={setQuery}
          leadingIcon={adaptIcon(Search01Icon, 18)}
          aria-label="Rechercher une personne"
        />
        <Select
          aria-label="Département"
          selectedKey={dept}
          onSelectionChange={(k) => setDept(String(k))}
          items={deptItems}
          renderValue={<span className="truncate">{deptCurrent?.label}</span>}
        >
          {deptItems.map((item) => (
            <SelectItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Risque"
          selectedKey={risk}
          onSelectionChange={(k) => setRisk(k as RiskLevel | 'all')}
          items={riskItems}
          renderValue={<span className="truncate">{riskCurrent?.label}</span>}
        >
          {riskItems.map((item) => (
            <SelectItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </Select>
        <Select
          aria-label="Statut"
          selectedKey={status}
          onSelectionChange={(k) => setStatus(k as EmployeeStatus | 'all')}
          items={statusItems}
          renderValue={<span className="truncate">{statusCurrent?.label}</span>}
        >
          {statusItems.map((item) => (
            <SelectItem key={item.id} id={item.id} textValue={item.label}>
              {item.label}
            </SelectItem>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border-button-default bg-background-primary-default shadow-card">
        <div className="grid grid-cols-[1fr_180px_130px_110px_100px_100px] items-center gap-3 border-b border-border-table bg-background-secondary-default px-4 py-2.5 text-caption-1-semibold text-text-secondary max-lg:hidden">
          <span>Personne</span>
          <span>Rôle</span>
          <span>Connaissances</span>
          <span>Uniques</span>
          <span>Risque</span>
          <span>Statut</span>
        </div>
        {filtered.length === 0 ? (
          <EmptyState
            title="Aucun collaborateur trouvé."
            detail="Ajustez vos filtres ou ajoutez un collaborateur."
            action={
              <Button leadingIcon={adaptIcon(UserAdd01Icon, 18)} onClick={() => pushToast('Invitation prête.')}>
                Ajouter un employé
              </Button>
            }
          />
        ) : (
          filtered.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate(`/people/${e.id}`)}
              className="grid w-full grid-cols-[1fr_180px_130px_110px_100px_100px] items-center gap-3 border-b border-separator-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background-primary-hover max-lg:grid-cols-[1fr_auto]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <PersonAvatar name={fullName(e)} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-body-medium text-text-primary">{fullName(e)}</span>
                  <span className="block truncate text-caption-1-medium text-text-tertiary lg:hidden">
                    {e.roleTitle} · {e.department}
                  </span>
                </span>
              </span>
              <span className="truncate text-body-2-regular text-text-secondary max-lg:hidden">
                {e.roleTitle}
              </span>
              <span className="text-body-2-medium text-text-primary tabular-nums max-lg:hidden">
                {e.memories.toLocaleString('fr-FR')}
              </span>
              <span className="max-lg:hidden">
                {e.uniqueKnowledge > 0 ? (
                  <span className="text-body-2-medium text-amber-600 tabular-nums">
                    {e.uniqueKnowledge} uniques
                  </span>
                ) : (
                  <span className="text-body-2-regular text-text-tertiary">—</span>
                )}
              </span>
              <span className="max-lg:hidden">
                <RiskBadge risk={e.risk} />
              </span>
              <span className="max-lg:hidden">
                <span
                  className={`inline-block rounded-md px-1.5 py-1 text-caption-1-medium ${STATUS_LABELS[e.status].cls}`}
                >
                  {STATUS_LABELS[e.status].label}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
