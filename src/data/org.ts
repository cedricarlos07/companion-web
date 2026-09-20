import type { Organization } from '@/types'

/** Shared organization facts — every screen reads from here so numbers stay
 * consistent across Home, People, Handovers, Approvals, etc. */
export const ORG: Organization = {
  workspace: 'Kamaloka AI',
  sector: 'Services professionnels',
  country: "Côte d'Ivoire",
  memories: 12842,
  employees: 42,
  rolesCount: 17,
  coverage: 84,
  criticalRisks: 6,
  activeAgents: 4,
  pendingApprovals: 3,
  health: {
    score: 84,
    documented: 91,
    verified: 79,
    upToDate: 88,
    shared: 73,
  },
  instance: 'brain.kamaloka.local',
  currentUser: 'Ange Niamké',
  currentUserRole: 'Directeur Général',
}

/** Risk d'oubli by role, shown on Home. */
export const HOME_ROLE_RISKS = [
  { role: 'Responsable Achats', value: 92, level: 'critical' as const },
  { role: 'Responsable Commercial', value: 67, level: 'attention' as const },
  { role: 'Finance Manager', value: 34, level: 'moderate' as const },
  { role: 'Operations', value: 18, level: 'healthy' as const },
]

/** Attention items for the Home « À traiter » card. */
export const ATTENTION_ITEMS = [
  {
    id: 'attention-tenders',
    severity: 'critical' as const,
    text: "78 % du savoir sur les appels d'offres dépend uniquement de Moussa.",
    cta: 'Résoudre',
    href: '/people/emp-moussa',
  },
  {
    id: 'attention-stale',
    severity: 'warning' as const,
    text: "5 procédures n'ont pas été mises à jour depuis plus de 12 mois.",
    cta: 'Voir',
    href: '/brain',
  },
  {
    id: 'attention-sav',
    severity: 'conflict' as const,
    text: 'Deux versions contradictoires du processus SAV.',
    cta: 'Comparer',
    href: '/brain/mem-sav-01',
  },
]

/** Overall knowledge risk (Knowledge Risk screen). */
export const RISK_OVERVIEW = {
  score: 31,
  level: 'moderate' as const,
  criticalPeople: 4,
  criticalRoles: 3,
  singleOwnerProcedures: 27,
  undocumentedTasks: 14,
}

/** Ranked risk by role (Knowledge Risk screen). */
export const RISK_BY_ROLE = [
  { role: 'Responsable Achats', value: 91 },
  { role: 'Commercial B2B', value: 74 },
  { role: 'Operations', value: 51 },
  { role: 'Finance', value: 29 },
  { role: 'RH', value: 17 },
]

/** Critical dependencies (Knowledge Risk screen). */
export const CRITICAL_DEPENDENCIES = [
  {
    id: 'dep-suppliers',
    text: '73 % des connaissances fournisseurs dépendent de Fatou.',
    href: '/people/emp-fatou',
  },
  {
    id: 'dep-clients',
    text: "12 relations clients critiques n'ont qu'un seul propriétaire interne.",
    href: '/knowledge-risk',
  },
  {
    id: 'dep-tasks',
    text: "14 activités récurrentes n'ont aucune procédure documentée.",
    href: '/brain',
  },
]
