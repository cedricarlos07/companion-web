import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { PORTAL_BILLING_PROFILE, PORTAL_CUSTOMER, PORTAL_INSTANCES, INSTALLED_VERSION, PORTAL_RELEASES, formatMoney } from '@/data/portal'

const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))

/** Portail client — vue d'ensemble : plan, licence, instance, versions. */
export function PortalDashboard() {
  const { pushToast } = useAppStore()
  const instance = PORTAL_INSTANCES[0]
  const latest = PORTAL_RELEASES[0]
  const updateAvailable = latest.version !== INSTALLED_VERSION
  const expiry = daysLeft(PORTAL_CUSTOMER.expiresAt)

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Bonjour ${PORTAL_CUSTOMER.name}`}
        subtitle={`${PORTAL_CUSTOMER.contact} — tout ce qui concerne votre abonnement Companion.`}
      />

      {updateAvailable && (
        <div className="card-highlight flex flex-wrap items-center justify-between gap-3 !p-4">
          <p className="text-body-medium text-text-primary">
            <span className="text-body-semibold">Companion {latest.version} est disponible</span>
            <span className="text-text-secondary"> — votre instance tourne en {INSTALLED_VERSION}.</span>
          </p>
          <Button size="small" onClick={() => pushToast('Rendez-vous dans Téléchargements — guide d\'upgrade inclus.', 'info')}>
            Voir la mise à jour
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Abonnement">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-title-2-semibold text-text-primary">{PORTAL_CUSTOMER.plan}</span>
            <Chip variant="subtle" color="lime">Licence {PORTAL_CUSTOMER.licenseStatus}</Chip>
          </div>
          <p className="mt-2 text-body-2-medium text-text-secondary">
            Expire le {new Date(PORTAL_CUSTOMER.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' '}· {expiry} jours restants
          </p>
          <p className="mt-1 text-caption-1-medium text-text-tertiary">Licence {PORTAL_CUSTOMER.licenseId}</p>
        </Card>

        <Card title="Instance active">
          <p className="text-title-2-semibold text-text-primary">{instance.name}</p>
          <p className="mt-2 text-body-2-medium text-text-secondary tabular-nums">{instance.id}</p>
          <p className="mt-1 text-caption-1-medium text-text-tertiary">
            Companion {instance.version} · dernier heartbeat {instance.lastHeartbeat}
          </p>
        </Card>

        <Card title="Versions">
          <p className="text-body-2-medium text-text-secondary">
            Installée <span className="text-body-semibold text-text-primary">{INSTALLED_VERSION}</span>
            {' '}· dernière disponible <span className="text-body-semibold text-text-primary">{latest.version}</span>
          </p>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            Les mises à jour sont réservées aux instances sous licence valide.
          </p>
        </Card>

        <Card title="Facturation">
          <p className="text-body-2-medium text-text-secondary">
            {formatMoney(PORTAL_CUSTOMER.annualPrice)} / an · cycle {PORTAL_BILLING_PROFILE.cycle === 'annuel' ? 'annuel' : 'mensuel'} · BYOK
          </p>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            Toutes vos factures sont disponibles dans l'onglet Factures.
          </p>
        </Card>
      </div>
    </div>
  )
}
