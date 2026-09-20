/**
 * Données de démonstration du Portail Client KamaLoka
 * (portal.companion.kamaloka.ai).
 *
 * Le portail gère la relation commerciale et technique post-vente : licence,
 * téléchargements, instances, factures, support. Il ne transporte JAMAIS de
 * données métier de l'instance Companion du client.
 *
 * Tarification : une seule édition Companion, prix régional, paiement annuel
 * par défaut (mensuel plus cher). V1 commerciale = B2B uniquement.
 */

export type Currency = 'XOF' | 'EUR' | 'USD'

export interface Money {
  amount: number
  currency: Currency
}

/** Format monétaire : « 2 400 000 FCFA » (XOF sans décimales) ou Intl pour EUR/USD. */
export function formatMoney({ amount, currency }: Money): string {
  if (currency === 'XOF') return `${amount.toLocaleString('fr-FR')} FCFA`
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(amount)
}

/** Price book régional — même produit, tarif par marché. */
export const PORTAL_PRICING: {
  region: string
  currency: Currency
  monthly: number
  annual: number
  deployment: number
}[] = [
  { region: 'Afrique francophone', currency: 'XOF', monthly: 250_000, annual: 2_400_000, deployment: 750_000 },
  { region: 'Europe', currency: 'EUR', monthly: 490, annual: 4_900, deployment: 1_500 },
]

export interface PaymentMethod {
  id: 'jeko' | 'stripe' | 'transfer'
  label: string
  detail: string
}

/**
 * Moyens de paiement proposés selon la devise du contrat.
 * Jèko encaisse l'Afrique (Mobile Money + cartes), Stripe l'Europe (cartes +
 * abonnements mensuels à renouvellement automatique) ; le virement reste
 * ouvert aux grands comptes partout. Le processeur n'est qu'une couche
 * d'encaissement : seul le Control Center KamaLoka émet les licences.
 */
export const PAYMENT_METHODS: Record<Currency, PaymentMethod[]> = {
  XOF: [
    {
      id: 'jeko',
      label: 'Payer avec Jèko',
      detail: 'Orange Money, Wave, MTN, Moov, Djamo ou carte — frais d\'encaissement 1,5 %',
    },
    {
      id: 'transfer',
      label: 'Virement bancaire',
      detail: 'Bon de commande + facture — activation après réception (grands comptes)',
    },
  ],
  EUR: [
    {
      id: 'stripe',
      label: 'Payer par carte — Stripe',
      detail: 'Cartes internationales ; abonnement mensuel à renouvellement automatique',
    },
    {
      id: 'transfer',
      label: 'Virement bancaire',
      detail: 'Facture EUR — virement SEPA / SWIFT international',
    },
  ],
  USD: [
    { id: 'stripe', label: 'Payer par carte — Stripe', detail: 'Cartes internationales' },
    { id: 'transfer', label: 'Virement bancaire', detail: 'Facture USD — virement SWIFT' },
  ],
}

/** Profil de facturation du client (géré dans le Control Center, reflété ici). */
export const PORTAL_BILLING_PROFILE = {
  legalName: 'Orange Côte d\'Ivoire SA',
  country: 'Côte d\'Ivoire',
  billingAddress: 'Route de Treichville, Abidjan',
  registration: 'RCCM CI-ABJ-2019-B-00000',
  vatId: '',
  billingContact: 'Ange Niamké · DSI',
  billingEmail: 'achats@orange.ci',
  currency: 'XOF' as Currency,
  cycle: 'annuel' as 'annuel' | 'mensuel',
}

export const PORTAL_CUSTOMER = {
  name: 'Orange Côte d\'Ivoire',
  contact: 'Ange Niamké · DSI',
  plan: 'Companion Business',
  planId: 'business',
  licenseId: 'LIC-KAM-001',
  licenseStatus: 'Active' as const,
  issuedAt: '2026-09-17',
  expiresAt: '2027-09-17',
  /** Prix du cycle courant, dans la devise du contrat. */
  annualPrice: { amount: 2_400_000, currency: 'XOF' } as Money,
  limits: { users: 100, agents: 20, integrations: 15, instances: 1 },
}

export interface PortalInstance {
  name: string
  id: string
  status: 'Active' | 'Grâce'
  version: string
  lastHeartbeat: string
  location: string
}

export const PORTAL_INSTANCES: PortalInstance[] = [
  {
    name: 'Production Abidjan',
    id: 'cmp_inst_7fd29c41',
    status: 'Active',
    version: '1.0.3',
    lastHeartbeat: 'il y a 3 h',
    location: 'VPS Orange Cloud · Abidjan',
  },
]

export interface PortalRelease {
  version: string
  channel: 'Stable' | 'LTS'
  date: string
  notes: string[]
  current?: boolean
}

export const PORTAL_RELEASES: PortalRelease[] = [
  {
    version: '1.0.3',
    channel: 'Stable',
    date: '2026-09-10',
    notes: [
      'Agent engine : reprise des workflows suspendus après redémarrage',
      'MCP : rotation de token sans coupure de session',
      'Performances de recherche mémoire (index hybride)',
    ],
  },
  {
    version: '1.0.2',
    channel: 'Stable',
    date: '2026-08-28',
    notes: ['Handover : génération d\'entretien guidé', 'Correctifs sécurité (durcissement MCP)'],
  },
  {
    version: '1.0.1',
    channel: 'Stable',
    date: '2026-08-14',
    notes: ['Import PST/MSG plus rapide', 'Correctifs UI du dashboard'],
  },
  {
    version: '1.0.0',
    channel: 'LTS',
    date: '2026-07-30',
    notes: ['Première version générale', 'Mémoire Mem0 + moteur agentique Mastra'],
  },
]

export interface PortalInvoice {
  id: string
  object: string
  amount: Money
  date: string
  status: 'Payée' | 'En attente'
}

export const PORTAL_INVOICES: PortalInvoice[] = [
  { id: 'FAC-2026-0045', object: 'Companion Business — licence annuelle', amount: { amount: 2_400_000, currency: 'XOF' }, date: '2026-09-17', status: 'Payée' },
  { id: 'FAC-2026-0012', object: 'Déploiement initial (self-hosted)', amount: { amount: 750_000, currency: 'XOF' }, date: '2026-07-22', status: 'Payée' },
]

/** Version de Companion installée sur l'instance du client (déclarée au heartbeat). */
export const INSTALLED_VERSION = '1.0.0'
