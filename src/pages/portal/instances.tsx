import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { PORTAL_CUSTOMER, PORTAL_INSTANCES } from '@/data/portal'

/** Portail client — instances self-hosted déclarées par les heartbeats. */
export function PortalInstancesPage() {
  const { pushToast } = useAppStore()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Instances"
        subtitle={`Instances déclarées sur votre licence (${PORTAL_CUSTOMER.limits.instances} autorisée).`}
      />

      <div className="space-y-3">
        {PORTAL_INSTANCES.map((instance) => (
          <Card key={instance.id} title={instance.name}>
            <div className="flex flex-wrap items-center gap-2">
              <Chip variant="subtle" color={instance.status === 'Active' ? 'lime' : 'yellow'}>
                {instance.status}
              </Chip>
              <span className="text-caption-1-medium text-text-tertiary tabular-nums">{instance.id}</span>
            </div>
            <p className="mt-2 text-body-2-medium text-text-secondary">
              Companion {instance.version} · dernier heartbeat {instance.lastHeartbeat}
            </p>
            <p className="mt-1 text-caption-1-medium text-text-tertiary">{instance.location}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="small"
                onClick={() => pushToast(`Détails de ${instance.name} : santé, compteurs et historique des contacts.`, 'info')}
              >
                Voir
              </Button>
              <Button
                variant="ghost"
                size="small"
                onClick={() =>
                  pushToast(
                    'Réinitialisation demandée — un agent KamaLoka validera le changement de serveur avant de libérer le slot.',
                    'info',
                  )
                }
              >
                Réinitialiser l'activation
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Card title="Déplacer Companion vers un nouveau serveur ?">
        <p className="text-body-2-medium text-text-secondary">
          Une instance copiée telle quelle obtient un nouvel identifiant et ne peut plus se
          rattacher à votre licence : c'est ce qui empêche les duplications non autorisées.
        </p>
        <p className="mt-2 text-caption-1-medium text-text-tertiary">
          « Réinitialiser l'activation » libère le slot après validation par KamaLoka — vos
          données, elles, sont restaurées depuis vos backups sur le nouveau serveur.
        </p>
      </Card>
    </div>
  )
}
