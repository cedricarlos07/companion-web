import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { PORTAL_BILLING_PROFILE, PORTAL_CUSTOMER, PORTAL_PRICING, formatMoney } from '@/data/portal'

/** Portail client — licence : plan, limites, fichier .lic, renouvellement. */
export function PortalLicensePage() {
  const { pushToast } = useAppStore()
  const limits = [
    ['Utilisateurs', PORTAL_CUSTOMER.limits.users],
    ['Agents', PORTAL_CUSTOMER.limits.agents],
    ['Intégrations', PORTAL_CUSTOMER.limits.integrations],
    ['Instances autorisées', PORTAL_CUSTOMER.limits.instances],
  ] as const

  return (
    <div className="space-y-4">
      <PageHeader title="Licence" subtitle="Votre droit d'usage de Companion, signé par KamaLoka." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Companion Business">
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant="subtle" color="lime">{PORTAL_CUSTOMER.licenseStatus}</Chip>
            <span className="text-caption-1-medium text-text-tertiary tabular-nums">
              {PORTAL_CUSTOMER.licenseId}
            </span>
          </div>
          <dl className="mt-3 space-y-1.5">
            {limits.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-body-2-medium text-text-secondary">{label}</dt>
                <dd className="text-body-2-semibold text-text-primary tabular-nums">{value}</dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-body-2-medium text-text-secondary">Expiration</dt>
              <dd className="text-body-2-semibold text-text-primary tabular-nums">
                {new Date(PORTAL_CUSTOMER.expiresAt).toLocaleDateString('fr-FR')}
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              size="small"
              onClick={() => pushToast(`companion-${PORTAL_CUSTOMER.licenseId}.lic téléchargé — importez-le dans Companion → Facturation.`, 'success')}
            >
              Télécharger la licence
            </Button>
            <Button variant="secondary" size="small" onClick={() => pushToast('Demande de renouvellement envoyée à KamaLoka.', 'success')}>
              Renouveler
            </Button>
          </div>
        </Card>

        <Card title="Renouvellement">
          <p className="text-body-2-medium text-text-secondary">
            Votre licence expire le{' '}
            {new Date(PORTAL_CUSTOMER.expiresAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}.
          </p>
          <p className="mt-2 text-body-2-medium text-text-secondary">
            {PORTAL_CUSTOMER.plan} — {formatMoney(PORTAL_CUSTOMER.annualPrice)} / an ·
            cycle {PORTAL_BILLING_PROFILE.cycle === 'annuel' ? 'annuel' : 'mensuel'}.
          </p>
          <p className="mt-2 text-caption-1-medium text-text-tertiary">
            L'engagement annuel est la formule par défaut (alignée sur la licence 12 mois) ; une
            formule mensuelle plus souple existe à un tarif majoré. Un renouvellement vous est
            proposé quelques semaines avant l'échéance et le nouveau fichier de licence apparaît
            ici dès son émission.
          </p>
          {(() => {
            const pricing = PORTAL_PRICING.find((p) => p.currency === PORTAL_BILLING_PROFILE.currency)
            return pricing ? (
              <p className="mt-1 text-caption-1-medium text-text-tertiary">
                Formule mensuelle : {formatMoney({ amount: pricing.monthly, currency: pricing.currency })} / mois
                {pricing.currency === 'XOF' && (
                  <> — soit {formatMoney({ amount: pricing.monthly * 12, currency: pricing.currency })} à l'année, contre {formatMoney({ amount: pricing.annual, currency: pricing.currency })} en annuel.</>
                )}
              </p>
            ) : null
          })()}
          <div className="mt-4">
            <Button variant="secondary" size="small" onClick={() => pushToast('Demande de renouvellement envoyée à KamaLoka.', 'success')}>
              Demander le renouvellement
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Comment ça marche">
        <p className="text-body-2-medium text-text-secondary">
          Le fichier <span className="text-body-semibold text-text-primary">.lic</span> est signé par
          KamaLoka (Ed25519) et vérifié localement par votre instance. En offre standard, un lease
          renouvelé automatiquement confirme la licence tous les 7 jours ; en Enterprise
          hors-ligne, la licence longue durée fait foi sans aucune connexion.
        </p>
        <p className="mt-2 text-caption-1-medium text-text-tertiary">
          Changement de plan (Business → Enterprise) : le nouveau fichier de licence remplace
          l'ancien ici, et vos limites sont ajustées automatiquement.
        </p>
      </Card>
    </div>
  )
}
