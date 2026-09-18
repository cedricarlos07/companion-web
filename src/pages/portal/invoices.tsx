import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { Button } from '@/components/base/buttons/button'
import { useAppStore } from '@/store/app-store'
import { PAYMENT_METHODS, PORTAL_BILLING_PROFILE, PORTAL_INVOICES, formatMoney } from '@/data/portal'

/** Portail client — factures : documents, profil de facturation, TVA UE. */
export function PortalInvoicesPage() {
  const { pushToast } = useAppStore()
  const profile = PORTAL_BILLING_PROFILE

  const profileRows: [string, string][] = [
    ['Raison sociale', profile.legalName],
    ['Pays', profile.country],
    ['Adresse de facturation', profile.billingAddress],
    ['Immatriculation', profile.registration],
    ['N° TVA UE', profile.vatId || '— (client hors UE)'],
    ['Contact facturation', profile.billingContact],
    ['Email facturation', profile.billingEmail],
    ['Devise', profile.currency],
    ['Cycle', profile.cycle === 'annuel' ? 'Annuel (par défaut)' : 'Mensuel'],
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="Factures"
        subtitle="Historique de facturation et coordonnées de facturation de votre compte KamaLoka."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Historique">
          <ul className="space-y-3">
            {PORTAL_INVOICES.map((invoice) => (
              <li
                key={invoice.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-body-medium text-text-primary tabular-nums">{invoice.id}</p>
                  <p className="mt-0.5 text-caption-1-medium text-text-tertiary">
                    {invoice.object} · {new Date(invoice.date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-body-medium text-text-primary tabular-nums">
                    {formatMoney(invoice.amount)}
                  </span>
                  <Chip variant="subtle" color={invoice.status === 'Payée' ? 'lime' : 'yellow'}>
                    {invoice.status}
                  </Chip>
                  <Button
                    variant="secondary"
                    size="xs"
                    onClick={() => pushToast(`${invoice.id}.pdf téléchargé.`, 'success')}
                  >
                    Télécharger PDF
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Profil de facturation">
          <dl className="space-y-1.5">
            {profileRows.map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-caption-1-medium text-text-tertiary">{label}</dt>
                <dd className="text-body-2-medium text-text-primary">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => pushToast('Modification des coordonnées de facturation : contactez votre interlocuteur KamaLoka.', 'info')}
            >
              Demander une modification
            </Button>
          </div>
        </Card>
      </div>

      <Card title="Mode de paiement">
        <p className="text-body-2-medium text-text-secondary">
          Pour votre contrat ({profile.currency} · cycle {profile.cycle === 'annuel' ? 'annuel' : 'mensuel'}) :
        </p>
        <div className="mt-3 space-y-2">
          {PAYMENT_METHODS[profile.currency].map((method) => (
            <button
              key={method.id}
              type="button"
              onClick={() =>
                pushToast(
                  method.id === 'transfer'
                    ? 'Coordonnées bancaires KamaLoka envoyées à votre contact facturation.'
                    : `Redirection vers le checkout ${method.id === 'jeko' ? 'Jèko' : 'Stripe'} (démo) — le paiement est confirmé par webhook.`,
                  'info',
                )
              }
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5 text-left outline-none transition-colors hover:border-border-button-hover hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <span>
                <span className="block text-body-medium text-text-primary">{method.label}</span>
                <span className="block text-caption-1-medium text-text-tertiary">{method.detail}</span>
              </span>
              <span className="shrink-0 text-caption-1-semibold text-accent-700">Choisir</span>
            </button>
          ))}
        </div>
      </Card>

      <Card title="Paiement en ligne : comment ça marche">
        <ol className="list-decimal space-y-1.5 pl-4 text-body-2-medium text-text-secondary">
          <li>Vous payez via Jèko (Mobile Money, carte) ou Stripe (carte) sur un checkout hébergé.</li>
          <li>
            Le <span className="text-body-semibold text-text-primary">webhook signé</span> du
            processeur confirme le paiement au Control Center KamaLoka — jamais le simple retour
            navigateur.
          </li>
          <li>Le Control Center passe la facture en « payée », prolonge la licence et signe le nouveau lease.</li>
          <li>Votre licence renouvelée apparaît dans l'onglet Licence, prête à télécharger.</li>
        </ol>
        <p className="mt-2 text-caption-1-medium text-text-tertiary">
          Le processeur ne fait qu'encaisser : seul le Control Center KamaLoka émet et renouvelle
          les licences. Paiement échoué : relances automatiques (Stripe) ou rappel par votre
          interlocuteur (Jèko, virement).
        </p>
      </Card>

      <Card title="TVA & facturation UE">
        <p className="text-body-2-medium text-text-secondary">
          Companion se vend aux <span className="text-body-semibold text-text-primary">entreprises (B2B)</span>.
          Pour un client professionnel établi dans l'UE et assujetti, la TVA n'est pas facturée par
          KamaLoka : le client la déclare par <span className="text-body-semibold text-text-primary">autoliquidation
          (reverse charge)</span> — le numéro de TVA du client est vérifié au préalable (VIES) et
          mentionné sur la facture.
        </p>
        <div className="mt-3 rounded-xl border border-separator-border bg-background-secondary-default p-4 font-mono text-caption-1-medium text-text-secondary">
          <p className="text-text-primary">KamaLoka AI Technologies → Société ABC France</p>
          <p className="mt-2">Companion — Licence commerciale 12 mois …… <span className="text-text-primary">4 900,00 €</span></p>
          <p>Déploiement Companion …………………………… <span className="text-text-primary">1 500,00 €</span></p>
          <p className="mt-2 border-t border-separator-border pt-2 text-text-primary">
            TOTAL ……………………………………………… 6 400,00 €
          </p>
          <p className="mt-2">VAT / TVA : Reverse charge — Autoliquidation</p>
          <p>N° TVA client : FRxxxxxxxxxxx</p>
        </div>
        <p className="mt-2 text-caption-1-regular text-text-tertiary">
          Paiement par facture et virement bancaire (FCFA local, EUR international). Le modèle de
          facture est validé avec notre conseil fiscal avant les premières factures européennes.
        </p>
      </Card>
    </div>
  )
}
