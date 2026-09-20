import { useOutletContext } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import type { PortalMe } from '@/services/portal'

/** Portail client — instances self-hosted déclarées par les heartbeats. */
export function PortalInstancesPage() {
  const me = useOutletContext<{ me: PortalMe }>().me

  return (
    <div className="space-y-4">
      <PageHeader
        title="Instances"
        subtitle={`Instances déclarées sur votre licence (${me.instances.length}/${me.maxInstances} utilisées).`}
      />

      <div className="space-y-3">
        {me.instances.length === 0 ? (
          <Card>
            <p className="text-body-2-medium text-text-secondary">
              Aucune instance activée — importez votre fichier de licence dans Companion
              (Facturation) pour la déclarer automatiquement.
            </p>
          </Card>
        ) : (
          me.instances.map((instance) => (
            <Card key={instance.instanceId} title={instance.instanceId.slice(0, 20) + '…'}>
              <div className="flex flex-wrap items-center gap-2">
                {instance.revoked ? (
                  <Chip variant="subtle" color="rose">Révoquée</Chip>
                ) : instance.lastMode === 'active' ? (
                  <Chip variant="subtle" color="lime">Active</Chip>
                ) : (
                  <Chip variant="subtle" color="yellow">{instance.lastMode ?? 'Inconnu'}</Chip>
                )}
                <span className="text-caption-1-medium text-text-tertiary">
                  Companion {instance.version ?? '?'}
                </span>
              </div>
              <p className="mt-2 text-body-2-medium text-text-secondary">
                Dernier contact :{' '}
                {instance.lastSeen ? new Date(instance.lastSeen).toLocaleString('fr-FR') : 'jamais'}
              </p>
              {instance.counts && Object.keys(instance.counts).length > 0 && (
                <p className="mt-1 text-caption-1-medium text-text-tertiary">
                  {instance.counts.users ?? 0} utilisateurs · {instance.counts.agents ?? 0} agents ·{' '}
                  {instance.counts.integrations ?? 0} intégrations
                </p>
              )}
              <div className="mt-4">
                <Button
                  variant="ghost"
                  size="small"
                  onClick={() => {
                    window.location.href =
                      'mailto:support@kamaloka.ai?subject=' +
                      encodeURIComponent(`Réinitialisation d'activation — ${instance.instanceId}`)
                  }}
                >
                  Réinitialiser l'activation
                </Button>
              </div>
            </Card>
          ))
        )}
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
