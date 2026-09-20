import { useEffect, useState } from 'react'
import { useOutletContext, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { portalGet, type PortalInvoice, type PortalMe, type PortalRelease, type PortalSession } from '@/services/portal'
import { formatMoney } from '@/services/portal'

interface PortalContext {
  me: PortalMe
  session: PortalSession
}

const daysLeft = (iso: string) =>
  Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))

/** Portail client — vue d'ensemble : plan, licence, instances, versions. */
export function PortalDashboard() {
  const { me, session } = useOutletContext<PortalContext>()
  const navigate = useNavigate()
  const [releases, setReleases] = useState<PortalRelease[]>([])
  const [invoices, setInvoices] = useState<PortalInvoice[]>([])

  useEffect(() => {
    portalGet<{ releases: PortalRelease[] }>(session, '/portal/api/releases').then((r) => {
      if (r) setReleases(r.releases)
    })
    portalGet<{ invoices: PortalInvoice[] }>(session, '/portal/api/invoices').then((r) => {
      if (r) setInvoices(r.invoices)
    })
  }, [session])

  const instance = me.instances[0]
  const latest = releases[0]
  const updateAvailable = Boolean(latest && instance?.version && latest.version !== instance.version)
  const expiry = me.expiresAt ? daysLeft(me.expiresAt) : null
  const lastPaid = invoices.find((v) => v.status === 'paid')

  return (
    <div className="space-y-4">
      <PageHeader
        title={`Bonjour ${me.customer}`}
        subtitle="Tout ce qui concerne votre abonnement Companion — licence, instances, facturation."
      />

      {me.licenseStatus !== 'active' && (
        <div role="alert" className="rounded-xl border border-border-error-default bg-background-tertiary-error px-4 py-3 text-body-2-medium text-text-error-primary">
          Votre licence est {me.licenseStatus === 'expired' ? 'expirée' : me.licenseStatus} — contactez KamaLoka pour la réactiver.
        </div>
      )}

      {updateAvailable && latest && (
        <div className="card-highlight flex flex-wrap items-center justify-between gap-3 !p-4">
          <p className="text-body-medium text-text-primary">
            <span className="text-body-semibold">Companion {latest.version} est disponible</span>
            <span className="text-text-secondary"> — votre instance tourne en {instance?.version ?? '?'}.</span>
          </p>
          <Button size="small" onClick={() => navigate('/portal/downloads')}>
            Voir la mise à jour
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Abonnement">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-title-2-semibold capitalize text-text-primary">{me.plan}</span>
            <Chip variant="subtle" color={me.licenseStatus === 'active' ? 'lime' : 'yellow'}>
              Licence {me.licenseStatus === 'active' ? 'active' : me.licenseStatus}
            </Chip>
          </div>
          {me.expiresAt && (
            <p className="mt-2 text-body-2-medium text-text-secondary">
              Expire le {new Date(me.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' '}· {expiry} jours restants
            </p>
          )}
          <p className="mt-1 text-caption-1-medium text-text-tertiary">Licence {me.licenseId}</p>
        </Card>

        <Card title="Instance active">
          {instance ? (
            <>
              <p className="text-title-2-semibold text-text-primary tabular-nums">
                {instance.instanceId.slice(0, 18)}…
              </p>
              <p className="mt-1 text-caption-1-medium text-text-tertiary">
                Companion {instance.version ?? '?'} · dernier contact{' '}
                {instance.lastSeen ? new Date(instance.lastSeen).toLocaleString('fr-FR') : '—'}
              </p>
            </>
          ) : (
            <p className="text-body-2-medium text-text-secondary">
              Aucune instance activée — importez votre licence dans Companion pour la déclarer.
            </p>
          )}
        </Card>

        <Card title="Versions">
          <p className="text-body-2-medium text-text-secondary">
            Installée <span className="text-body-semibold text-text-primary">{instance?.version ?? '—'}</span>
            {latest && (
              <>
                {' '}· dernière disponible <span className="text-body-semibold text-text-primary">{latest.version}</span>
              </>
            )}
          </p>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            Les mises à jour sont réservées aux instances sous licence valide.
          </p>
        </Card>

        <Card title="Facturation">
          <p className="text-body-2-medium text-text-secondary">
            {lastPaid
              ? `Dernier paiement : ${formatMoney(lastPaid.amount, lastPaid.currency)} (${lastPaid.months} mois · ${lastPaid.currency})`
              : 'Aucun paiement enregistré — contactez KamaLoka.'}
          </p>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            Toutes vos factures sont disponibles dans l'onglet Factures.
          </p>
        </Card>
      </div>
    </div>
  )
}
