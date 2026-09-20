import type { Handover, InterviewQuestion, Onboarding } from '@/types'

/* ------------------------------- Handovers ------------------------------- */

export const HANDOVERS: Handover[] = [
  {
    id: 'hov-moussa',
    employeeId: 'emp-moussa',
    employeeName: 'Moussa Koné',
    roleTitle: 'Responsable Commercial',
    status: 'interview',
    readiness: 82,
    coverage: [
      { label: 'Clients', value: 96 },
      { label: 'Projets', value: 88 },
      { label: 'Procédures', value: 79 },
      { label: 'Tâches récurrentes', value: 74 },
      { label: 'Relations', value: 91 },
      { label: 'Contexte de décision', value: 68 },
    ],
    gaps: [
      {
        id: 'gap-forecast',
        question: 'Comment le forecast commercial mensuel est-il préparé ?',
        kind: 'missing',
        detail: 'Aucune procédure documentée. Connaissance unique de Moussa.',
        cta: 'interview',
      },
      {
        id: 'gap-remises',
        question: 'Qui valide les remises exceptionnelles supérieures à 15 % ?',
        kind: 'conflict',
        detail: 'Informations contradictoires : Direction Financière (2023) ou Direction Générale (2026) ?',
        cta: 'resolve',
      },
      {
        id: 'gap-renouvellements',
        question: 'Quel est le calendrier de renouvellement des contrats clés ?',
        kind: 'missing',
        detail: 'Dates de reconduction connues de Moussa uniquement.',
        cta: 'interview',
      },
      {
        id: 'gap-orange-checklist',
        question: 'Checklist complète de dépôt des dossiers Orange CI ?',
        kind: 'missing',
        detail: 'Partiellement documentée — étapes de conformité manquantes.',
        cta: 'interview',
      },
      {
        id: 'gap-nsia-contacts',
        question: 'Qui relaie la relation NSIA pendant le départ ?',
        kind: 'conflict',
        detail: 'Deux propriétaires internes désignés dans des sources différentes.',
        cta: 'resolve',
      },
      {
        id: 'gap-cloture',
        question: 'Procédure de clôture mensuelle du pipeline commercial ?',
        kind: 'missing',
        detail: 'Étapes connues mais jamais documentées.',
        cta: 'interview',
      },
    ],
    updatedAt: 'Il y a 11 min',
  },
]

export function getHandover(id: string): Handover | undefined {
  return HANDOVERS.find((h) => h.id === id)
}

/** Live analysis steps shown while the Handover Agent runs (departure prep). */
export const HANDOVER_ANALYSIS_STEPS = [
  { id: 'st-1', label: 'Analyse des projets actifs…' },
  { id: 'st-2', label: 'Analyse des procédures…' },
  { id: 'st-3', label: 'Cartographie des relations clients…' },
  { id: 'st-4', label: 'Recherche des connaissances uniques…' },
  { id: 'st-5', label: 'Détection des informations manquantes…' },
  { id: 'st-6', label: 'Construction du contexte du successeur…' },
]

/** Knowledge interview — 9 questions, 6 answered in the demo state. */
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'q-1',
    prompt:
      'Quels sont les engagements verbaux pris envers SOTRA qui ne figurent dans aucun contrat ?',
    answer:
      "On s'est engagé à prévenir 15 jours avant toute modification tarifaire, même si le contrat ne le prévoit pas. Et pour la trêve de fin d'année, on ne lance aucune opération chez eux sans accord préalable de M. Bakayoko.",
    producedMemory: {
      type: 'relationship',
      title: 'Engagements informels SOTRA — préavis tarifaire et trêve',
      confidence: 88,
    },
  },
  {
    id: 'q-2',
    prompt: 'Comment évaluez-vous la fiabilité de paiement de chaque client ?',
    answer:
      'Ecobank et NSIA paient toujours à date. Orange CI paie à 45 jours malgré les 30 jours contractuels. CIE a des retards en période de campagne. Je note tout dans le fichier de suivi interne.',
    producedMemory: {
      type: 'fact',
      title: 'Fiabilité de paiement par client (retours terrain)',
      confidence: 82,
    },
  },
  {
    id: 'q-3',
    prompt: 'Quels documents rassemblez-vous avant chaque appel doffres public ?',
    answer:
      'Attestation fiscale de moins de 3 mois, attestations bancaires, références signées des 3 derniers projets similaires, et la caution de 2 %. Je garde un dossier modèle prêt à copier.',
    producedMemory: {
      type: 'procedure',
      title: "Dossier type pour les appels d'offres publics",
      confidence: 90,
    },
  },
  {
    id: 'q-4',
    prompt: 'Qui sont les décideurs réels chez Orange CI ?',
    answer:
      'Officiellement cest le service achats, mais la décision passe par la direction technique réseau. M. Traoré y est le point dentrée correct, jamais avant 10 h.',
    producedMemory: {
      type: 'relationship',
      title: 'Orange CI — décideurs réels et point dentrée',
      confidence: 79,
    },
  },
  {
    id: 'q-5',
    prompt: 'Que faites-vous quand un client demande une remise non prévue ?',
    answer:
      'Je qualifie dabord le volume annuel. Ensuite je prépare une note de marge avec Ibrahim. Au-delà de 15 % on en parle systématiquement en comité.',
    producedMemory: {
      type: 'lesson',
      title: 'Conduite à tenir devant une demande de remise hors grille',
      confidence: 76,
    },
  },
  {
    id: 'q-6',
    prompt:
      'Je constate que tu prépares chaque mois le forecast commercial, mais je ne trouve aucune procédure. Peux-tu expliquer comment tu le réalises ?',
    answer:
      'Le 25 du mois je collecte les prévisions de chaque commercial dans le modèle partagé. Je pondère par probabilité de closing : 90 % si contrat envoyé, 50 % si proposition, 20 % si discussion. Je compare aux écarts du mois précédent, puis je passe la revue avec Ibrahim avant diffusion à la direction.',
    producedMemory: {
      type: 'procedure',
      title: 'Préparation du forecast commercial mensuel',
      confidence: 91,
    },
  },
  {
    id: 'q-7',
    prompt: 'Quels sont les signes qui doivent alerter avant la perte dun client ?',
  },
  { id: 'q-8', prompt: 'Comment préparez-vous la revue commerciale trimestrielle ?' },
  {
    id: 'q-9',
    prompt: 'Quelles tâches faites-vous chaque semaine que personne dautre ne voit ?',
  },
]

/* ------------------------------ Onboarding ------------------------------- */

export const ONBOARDINGS: Onboarding[] = [
  {
    id: 'onb-yann',
    employeeName: 'Yann Kouamé',
    roleTitle: 'Responsable Commercial',
    startDate: '21 septembre',
    readiness: 92,
    progress: 38,
    builtFrom: [
      'Role Brain — Responsable Commercial (3 428 connaissances)',
      'Handover de Moussa Koné (82 % → pack 94 %)',
      'Company Brain (12 842 connaissances)',
      'Projets actifs (4)',
    ],
    sections: [
      {
        id: 'sec-day1',
        title: 'Jour 1',
        detail: 'Accès, présentation, première connexion à Companion.',
        icon: 'role',
        items: [
          'Créer vos accès (email, CRM, Companion)',
          'Rencontrer Ibrahim, Aïcha et Koffi',
          'Lire le résumé du rôle — 10 minutes',
        ],
        done: true,
      },
      {
        id: 'sec-role',
        title: 'Comprendre le rôle',
        detail: 'Responsabilités, objectifs et routine du poste.',
        icon: 'role',
        items: [
          'Responsabilités du Responsable Commercial',
          'Les 12 tâches récurrentes du poste',
          'Objectifs du trimestre',
        ],
        done: true,
      },
      {
        id: 'sec-customers',
        title: 'Clients',
        detail: 'Le portefeuille, son histoire et ses engagements.',
        icon: 'customers',
        items: [
          'Orange CI — exigences de conformité et décideurs réels',
          'SOTRA — engagements informels et facturation trimestrielle',
          'NSIA, CIE, Ecobank — conditions cadre',
        ],
        done: true,
      },
      {
        id: 'sec-procedures',
        title: 'Procédures critiques',
        detail: 'Les procédures à maîtriser dès les premières semaines.',
        icon: 'procedures',
        items: [
          "Validation des dossiers Orange CI par la Direction Financière",
          "Préparation des appels d'offres publics",
          'Préparation du forecast commercial mensuel',
        ],
        done: false,
      },
      {
        id: 'sec-projects',
        title: 'Projets en cours',
        detail: 'Ce qui tourne actuellement et où vous intervenez.',
        icon: 'projects',
        items: [
          'Migration ERP SOTRA — phase pilote',
          'Extension fibre Abidjan Sud (à risque)',
          'Déploiement NSIA — phase 1',
        ],
        done: false,
      },
      {
        id: 'sec-people',
        title: 'Personnes à connaître',
        detail: 'Votre réseau interne et les contacts clients clés.',
        icon: 'people',
        items: [
          'Ibrahim Diallo — validation financière',
          'Aïcha Diarra — commerciale B2B',
          'Contacts clients par compte',
        ],
        done: false,
      },
      {
        id: 'sec-decisions',
        title: 'Décisions importantes',
        detail: 'Les décisions récentes et leur rationale.',
        icon: 'decisions',
        items: [
          'Pourquoi la facturation SOTRA est passée au trimestriel',
          'Politique de remises et validation',
        ],
        done: false,
      },
      {
        id: 'sec-tasks',
        title: 'Tâches récurrentes',
        detail: 'Le rythme hebdomadaire et mensuel du poste.',
        icon: 'tasks',
        items: ['Forecast mensuel (le 25)', 'Revue pipeline hebdomadaire', 'Relances clients du vendredi'],
        done: false,
      },
      {
        id: 'sec-check',
        title: 'Vérification des connaissances',
        detail: 'Un quiz court pour valider lessentiel.',
        icon: 'check',
        items: ['10 questions sur les clients et procédures critiques'],
        done: false,
      },
      {
        id: 'sec-ask',
        title: 'Demander à Companion',
        detail: 'Posez toutes vos questions à la mémoire de lentreprise.',
        icon: 'ask',
        items: ['Exemples de questions pour démarrer'],
        done: false,
      },
    ],
  },
]

export function getOnboarding(id: string): Onboarding | undefined {
  return ONBOARDINGS.find((o) => o.id === id)
}
