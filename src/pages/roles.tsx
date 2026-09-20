import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { RiskBadge } from '@/components/common/badges'
import { ProgressRow } from '@/components/common/progress'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { HierarchyIcon, UserGroupIcon, RefreshIcon } from '@/lib/icons'
import { api } from '@/services/api'
import type { Role } from '@/types'
import { formatNumber } from '@/lib/format'

export function RolesPage() {
  const navigate = useNavigate()
  const [roleList, setRoleList] = useState<Role[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const real = await api.roles()
    if (real === null) {
      setError('Impossible de charger les rôles — backend indisponible.')
      setRoleList([])
      return
    }
    setRoleList(real)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div>
      <PageHeader
        title="Rôles"
        subtitle="Le savoir appartient aux rôles, pas uniquement aux individus."
        actions={
          <Button variant="secondary" leadingIcon={adaptIcon(RefreshIcon, 20)} onClick={() => void load()}>
            Rafraîchir
          </Button>
        }
      />

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
