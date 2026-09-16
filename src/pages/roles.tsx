import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { RiskBadge } from '@/components/common/badges'
import { ProgressRow } from '@/components/common/progress'
import { Card } from '@/components/common/stat-card'
import { Button } from '@/components/base/buttons/button'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { HierarchyIcon, UserGroupIcon, PlusSignIcon } from '@/lib/icons'
import { ROLES } from '@/data/roles'
import { api } from '@/services/api'
import type { Role } from '@/types'
import { useEffect, useState } from 'react'
import { formatNumber } from '@/lib/format'
import { useAppStore } from '@/store/app-store'

export function RolesPage() {
  const navigate = useNavigate()
  const { pushToast } = useAppStore()
  const [roleList, setRoleList] = useState<Role[]>(ROLES)
  useEffect(() => {
    api.roles().then((real) => {
      if (real && real.length > 0) setRoleList(real)
    })
  }, [])

  return (
    <div>
      <PageHeader
        title="Rôles"
        subtitle="Le savoir appartient aux rôles, pas uniquement aux individus."
        actions={
          <Button
            leadingIcon={adaptIcon(PlusSignIcon, 20)}
            onClick={() => pushToast('Création de rôle — démo : rôle simulé créé.')}
          >
            Créer un rôle
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roleList.map((role) => (
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
              <span>· {role.formerContributors} anciens contributeurs</span>
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
        ))}
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
