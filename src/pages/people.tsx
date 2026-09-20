import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import type { Employee, EmployeeStatus, RiskLevel, Role } from '@/types'

const STATUS_LABELS: Record<EmployeeStatus, { label: string; cls: string }> = {
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

function fullName(e: Employee) {
  return `${e.firstName} ${e.lastName}`
}

export function PeoplePage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [allEmployees, setAllEmployees] = useState<Employee[] | null>(null)
  const [roles, setRoles] = useState<Role[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState('all')
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all')
  const [status, setStatus] = useState<EmployeeStatus | 'all'>('all')

  // Formulaire d'ajout (POST /employees réel).
  const [addOpen, setAddOpen] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const real = await api.employees()
    if (real === null) {
      setError('Impossible de charger les personnes — backend indisponible.')
      setAllEmployees([])
      return
    }
    setAllEmployees(real)
  }, [])

  useEffect(() => {
    void load()
    api.roles().then((r) => {
      if (r) setRoles(r)
    })
  }, [load])

  async function addEmployee() {
    if (adding) return
    if (firstName.trim().length < 2 || lastName.trim().length < 2 || !email.includes('@')) {
      pushToast('Prénom, nom et email valides requis.', 'error')
      return
    }
    setAdding(true)
    const res = await api.createEmployee({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      roleId: roleId || undefined,
    })
    setAdding(false)
    if (res === null) {
      pushToast('Création impossible — email déjà utilisé ou permission manquante.', 'error')
      return
    }
    pushToast(`${firstName.trim()} ${lastName.trim()} ajouté·e.`, 'success')
    setAddOpen(false)
    setFirstName('')
    setLastName('')
    setEmail('')
    setRoleId('')
    void load()
  }

  const departments = useMemo(() => [...new Set((allEmployees ?? []).map((e) => e.department))], [allEmployees])

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
    return (allEmployees ?? []).filter((e) => {
      if (dept !== 'all' && e.department !== dept) return false
      if (risk !== 'all' && e.risk !== risk) return false
      if (status !== 'all' && e.status !== status) return false
      if (q && !`${fullName(e)} ${e.roleTitle}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [allEmployees, query, dept, risk, status])

  return (
    <div>
      <PageHeader
        title="Personnes"
        subtitle="Le savoir de chaque collaborateur, capturé et exploitable."
        actions={
          <Button leadingIcon={adaptIcon(UserAdd01Icon, 20)} onClick={() => setAddOpen((o) => !o)}>
            Ajouter un employé
          </Button>
        }
      />

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      {addOpen && (
        <div className="mb-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input label="Prénom" value={firstName} onChange={setFirstName} placeholder="Awa" />
            <Input label="Nom" value={lastName} onChange={setLastName} placeholder="Traoré" />
            <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="awa.traore@entreprise.ci" />
            <Select
              aria-label="Rôle"
              selectedKey={roleId}
              onSelectionChange={(k) => setRoleId(String(k))}
              items={[{ id: '', label: 'Sans rôle' }, ...roles.map((r) => ({ id: r.id, label: r.title }))]}
              renderValue={<span className="truncate">{roles.find((r) => r.id === roleId)?.title ?? 'Sans rôle'}</span>}
            >
              {[{ id: '', label: 'Sans rôle' }, ...roles.map((r) => ({ id: r.id, label: r.title }))].map((item) => (
                <SelectItem key={item.id} id={item.id} textValue={item.label}>
                  {item.label}
                </SelectItem>
              ))}
            </Select>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={() => void addEmployee()} disabled={adding}>
              {adding ? 'Création…' : 'Créer'}
            </Button>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>Annuler</Button>
          </div>
        </div>
      )}

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
        {allEmployees === null ? (
          <p className="px-4 py-4 text-body-2-medium text-text-tertiary">Chargement des personnes…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Aucun collaborateur trouvé."
            detail="Ajustez vos filtres ou ajoutez un collaborateur."
            action={
              <Button leadingIcon={adaptIcon(UserAdd01Icon, 18)} onClick={() => setAddOpen(true)}>
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
