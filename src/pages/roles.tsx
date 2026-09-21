import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { RiskBadge } from '@/components/common/badges'
import { ProgressRow } from '@/components/common/progress'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { HierarchyIcon, UserGroupIcon, RefreshIcon, PlusSignIcon } from '@/lib/icons'
import { api } from '@/services/api'
import { useAppStore } from '@/store/app-store'
import { Input } from '@/components/base/input/input'
import type { Role } from '@/types'
import { formatNumber } from '@/lib/format'

export function RolesPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [roleList, setRoleList] = useState<Role[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Création réelle (POST /roles + POST /departments à la volée)
  const [createOpen, setCreateOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [departmentName, setDepartmentName] = useState('')
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const real = await api.roles()
    if (real === null) {
      setError('Impossible de charger les rôles — backend indisponible.')
      setRoleList([])
      return
    }
    setRoleList(real)
    const depts = await api.departments()
    if (depts) setDepartments(depts.departments)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function createRole() {
    if (creating) return
    if (title.trim().length < 2) {
      pushToast('Intitulé du rôle requis.', 'error')
      return
    }
    setCreating(true)
    let deptId: string | undefined
    const deptName = departmentName.trim()
    if (deptName) {
      const known = departments.find((d) => d.name.toLowerCase() === deptName.toLowerCase())
      if (known) deptId = known.id
      else {
        const createdDept = await api.createDepartment(deptName)
        if (createdDept.ok) {
          deptId = createdDept.data.department.id
          setDepartments((l) => [...l, createdDept.data.department])
        } else {
          pushToast(createdDept.error, 'error')
          setCreating(false)
          return
        }
      }
    }
    const res = await api.createRole({ title: title.trim(), departmentId: deptId })
    setCreating(false)
    if (!res.ok) {
      pushToast(res.error, 'error')
      return
    }
    pushToast(`Rôle « ${title.trim()} » créé.`, 'success')
    setTitle('')
    setDepartmentName('')
    setCreateOpen(false)
    void load()
  }

  return (
    <div>
      <PageHeader
        title="Rôles"
        subtitle="Le savoir appartient aux rôles, pas uniquement aux individus."
        actions={
          <>
            <Button variant="secondary" leadingIcon={adaptIcon(RefreshIcon, 20)} onClick={() => void load()}>
              Rafraîchir
            </Button>
            <Button leadingIcon={adaptIcon(PlusSignIcon, 20)} onClick={() => setCreateOpen((o) => !o)}>
              Créer un rôle
            </Button>
          </>
        }
      />

      {createOpen && (
        <div className="mb-4 rounded-2xl border border-border-button-default bg-background-primary-default p-4 shadow-card">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Intitulé du rôle" value={title} onChange={setTitle} placeholder="ex. Responsable Commercial" />
            <Input
              label="Département (existant ou nouveau)"
              value={departmentName}
              onChange={setDepartmentName}
              placeholder={departments[0]?.name ?? 'ex. Commercial'}
              hint={departments.length > 0 ? `Existants : ${departments.map((d) => d.name).join(', ')}` : undefined}
            />
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => void createRole()} disabled={creating}>
              {creating ? 'Création…' : 'Créer le rôle'}
            </Button>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
          </div>
        </div>
      )}

      {error && (
        <div role="alert" className="mb-4 rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roleList === null ? (
          <Card>
            <p className="text-body-2-medium text-text-tertiary">Chargement des rôles…</p>
          </Card>
        ) : roleList.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">Aucun rôle défini pour cette organisation.</p>
          </Card>
        ) : (
          roleList.map((role) => (
            <button
              key={role.id}
              type="button"
              onClick={() => navigate(`/roles/${role.id}`)}
              className="group rounded-2xl border border-border-button-default bg-background-primary-default p-4 text-left shadow-card transition-colors hover:bg-background-primary-hover"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-background-secondary-default">
                    <HugeIcon icon={HierarchyIcon} size="md" className="text-foreground-icon-secondary" />
                  </span>
                  <span>
                    <span className="block text-headline-medium text-text-primary">{role.title}</span>
                    <span className="block text-caption-1-medium text-text-tertiary">{role.department}</span>
                  </span>
                </span>
                <RiskBadge risk={role.risk} />
              </div>

              <div className="mb-3 flex items-center gap-3 text-caption-1-medium text-text-secondary">
                <span className="inline-flex items-center gap-1">
                  <HugeIcon icon={UserGroupIcon} size="xs" />
                  {role.currentEmployees} en poste
                </span>
                <span>· {role.contributors} contributeurs</span>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-body-2-medium text-text-primary">
                <span>{formatNumber(role.memories)} connaissances</span>
                <span>{role.procedures} procédures</span>
              </div>

              <ProgressRow
                label="Couverture du rôle"
                value={role.coverage}
                tone={role.coverage >= 80 ? 'success' : role.coverage >= 60 ? 'default' : 'critical'}
              />
            </button>
          ))
        )}
      </div>

      <Card className="mt-4">
        <p className="text-body-2-regular text-text-secondary">
          Chaque rôle agrège les contributions de toutes les personnes qui l'ont occupé : quand un employé
          part, la mémoire du rôle reste.
        </p>
      </Card>
    </div>
  )
}
