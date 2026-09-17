/**
 * Plans commerciaux Kamaloka — clés d'entitlements IDENTIQUES à celles que
 * Companion consomme (server/services/entitlements.ts).
 *
 * Business : 2 400 000 FCFA/an (≈ 2 mois offerts vs 250 000 F/mois).
 * Installation : 750 000 FCFA (prestation, facturée séparément).
 */

export interface PlanDef {
  label: string
  priceAnnualFcf: number | null
  priceMonthlyFcf: number | null
  installationFcf: number
  maxInstances: number
  entitlements: Record<string, unknown>
}

export const PLANS: Record<string, PlanDef> = {
  pilot: {
    label: 'Pilot',
    priceAnnualFcf: 0,
    priceMonthlyFcf: null,
    installationFcf: 0,
    maxInstances: 1,
    entitlements: {
      'users.max': 25,
      'agents.max': 3,
      'mcpClients.max': 3,
      'sources.max': 3,
      'storage.maxGb': 5,
      advancedAudit: false,
      sso: false,
      customBranding: false,
      prioritySupport: false,
      advancedBackup: false,
    },
  },
  business: {
    label: 'Business',
    priceAnnualFcf: 2_400_000,
    priceMonthlyFcf: 250_000,
    installationFcf: 750_000,
    maxInstances: 1,
    entitlements: {
      'users.max': 100,
      'agents.max': 20,
      'mcpClients.max': 5,
      'sources.max': 15,
      'storage.maxGb': 50,
      advancedAudit: true,
      sso: false,
      customBranding: false,
      prioritySupport: true,
      advancedBackup: true,
    },
  },
  enterprise: {
    label: 'Enterprise',
    priceAnnualFcf: null, // sur devis
    priceMonthlyFcf: null,
    installationFcf: null as unknown as number, // sur devis
    maxInstances: 3,
    entitlements: {
      'users.max': 9999,
      'agents.max': 9999,
      'mcpClients.max': 50,
      'sources.max': 9999,
      'storage.maxGb': 2000,
      advancedAudit: true,
      sso: true,
      customBranding: true,
      prioritySupport: true,
      advancedBackup: true,
    },
  },
}

export function formatFcf(n: number | null): string {
  if (n === null || Number.isNaN(n)) return 'sur devis'
  return `${n.toLocaleString('fr-FR')} FCFA`
}
