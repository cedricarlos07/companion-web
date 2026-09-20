import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { PageHeader } from '@/components/common/page-header'
import { Card } from '@/components/common/stat-card'
import { Chip } from '@/components/base/badges/chip'
import { portalGet, formatMoney, type PortalInvoice, type PortalMe, type PortalSession } from '@/services/portal'

interface PortalContext {
  me: PortalMe
  session: PortalSession
}

/** Portail client — factures : historique réel du Control Center. */
export function PortalInvoicesPage() {
  const { me, session } = useOutletContext<PortalContext>()
  const [invoices, setInvoices] = useState<PortalInvoice[] | null>(null)

  useEffect(() => {
    portalGet<{ invoices: PortalInvoice[] }>(session, '/portal/api/invoices').then((r) => {
      setInvoices(r?.invoices ?? [])
    })
  }, [session])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Factures"
        subtitle="Historique de facturation de votre compte KamaLoka."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Historique">
          {invoices === null ? (
            <p className="text-body-2-medium text-text-tertiary">Chargement des factures…</p>
          ) : invoices.length === 0 ? (
            <p className="text-body-2-medium text-text-secondary">
              Aucune facture enregistrée — votre contact KamaLoka peut les y déposer dès émission.
            </p>
          ) : (
            <ul className="space-y-3">
              {invoices.map((invoice) => (
                <li
                  key={invoice.number}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-separator-border pb-3 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-body-medium text-text-primary tabular-nums">{invoice.number}</p>
                    <p className="mt-0.5 text-caption-1-medium text-text-tertiary">
                      Licence {invoice.months} mois · {new Date(invoice.paid_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-body-medium text-text-primary tabular-nums">
                      {formatMoney(invoice.amount, invoice.currency)}
                    </span>
                    <Chip variant="subtle" color={invoice.status === 'paid' ? 'lime' : 'yellow'}>
                      {invoice.status === 'paid' ? 'Payée' : invoice.status}
                    </Chip>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-caption-1-medium text-text-tertiary">
            PDF disponible sur demande auprès de KamaLoka (support@kamaloka.ai).
          </p>
        </Card>

        <Card title="Profil de facturation">
          <dl className="space-y-1.5">
            {([
              ['Client', me.customer],
              ['Licence', me.licenseId],
              ['Plan', me.plan],
              ['Devise', me.currency],
              ['Cycle', me.cycle === 'annuel' ? 'Annuel (par défaut)' : 'Mensuel'],
            ] as [string, string][]).map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-3">
                <dt className="text-caption-1-medium text-text-tertiary">{label}</dt>
                <dd className="text-body-2-medium text-text-primary capitalize">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-3">
            <a
              href="mailto:support@kamaloka.ai?subject=Modification%20des%20coordonn%C3%A9es%20de%20facturation"
              className="inline-flex rounded-lg border border-border-button-default px-3 py-1.5 text-body-2-medium text-text-secondary transition-colors hover:bg-background-primary-hover"
            >
              Demander une modification
            </a>
          </div>
        </Card>
      </div>

      <Card title="Modes de paiement acceptés">
        <p className="text-body-2-medium text-text-secondary">
          Pour votre contrat ({me.currency} · cycle {me.cycle}) :
        </p>
        <ul className="mt-3 space-y-2">
          {(me.currency === 'EUR'
            ? [
                ['Stripe (carte)', 'Checkout hébergé, abonnement à renouvellement automatique, reçus et relances.'],
                ['Virement bancaire', 'Bon de commande + facture — validation manuelle à réception.'],
              ]
            : [
                ['Jèko (Mobile Money, carte)', 'Orange Money, Wave, MTN, Moov, Djamo, carte — facture annuelle ou mensuelle réémise.'],
                ['Virement bancaire', 'Bon de commande + facture — validation manuelle à réception (grands comptes).'],
              ]
          ).map(([label, detail]) => (
            <li key={label} className="rounded-xl border border-border-button-default bg-background-primary-default px-3 py-2.5">
              <span className="block text-body-medium text-text-primary">{label}</span>
              <span className="block text-caption-1-medium text-text-tertiary">{detail}</span>
            </li>
          ))}
        </ul>
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
          les licences.
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
        <p className="mt-2 text-caption-1-regular text-text-tertiary">
          Paiement par facture et virement bancaire (FCFA local, EUR international). Le modèle de
          facture est validé avec notre conseil fiscal avant les premières factures européennes.
        </p>
      </Card>
    </div>
  )
}
