import bcrypt from 'bcryptjs'
import type { DbHandle } from './db/client.js'
import { embed, toPgVectorLiteral } from './services/embeddings.js'
import { createMemory } from './services/memory.js'
import { audit } from './audit.js'

/**
 * Seed — reproduces EXACTLY the current demo dataset in the real database:
 * Kamaloka AI, 42 employees, 17 roles, 12 842 memories (deterministically
 * generated), the named people (Moussa, Awa, Fatou, Ibrahim, Yann, Mariama,
 * Koffi, Aïcha), the rich handcrafted memories, the clients, the handover at
 * 82 % and Yann's onboarding — so the UI numbers stay coherent.
 */

// Deterministic PRNG so every seed run produces the same dataset.
function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20260915)
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]

const FIRST_NAMES = ['Serge', 'Adama', 'Sylvie', 'Bernard', 'Christine', 'Paul', 'Nadia', 'Rachid', 'Clarisse', 'Jean-Marc', 'Aminata', 'Ousmane', 'Grâce', 'Emmanuel', 'Bintou', 'Franck', 'Salif', 'Diane', 'Yves', 'Chantal', 'Modibo', 'Estelle', 'Patrick', 'Ramata', 'Guy', 'Fatoumata', 'Alain', 'Kadidja', 'Bruno', 'Mariam', 'Didier', 'Sandra', 'Ali', 'Josiane']
const LAST_NAMES = ['Kouadio', 'Sanogo', 'Bamba', 'Adjovi', 'Yao', 'Mensah', 'Cissé', 'Traoré', 'Zadi', 'Ouattara', 'Kouassi', 'Doumbia', 'Koffi', 'Sangaré', 'Gbagbo', 'Tanoh', 'Bakayoko', 'Dosso', 'Aké', 'Konaté', 'Silué', 'Aka', 'Boni', 'Guéi', 'Loba', 'Assi', 'Tanoh', 'Séry', 'Ehouman', 'Brou', 'Yéboué', 'Zaba', 'Irié', 'Bognini']

const DEPARTMENTS = [
  'Commercial', 'Opérations', 'Finance', 'RH', 'Achats', 'Produit', 'IT', 'Juridique',
  'Marketing', 'Logistique', 'Qualité', 'Support', 'Ingénierie', 'Audit interne',
  'Communication', 'Trésorerie', 'Contrôle de gestion',
]

const ROLE_TITLES = [
  'Responsable Commercial', 'Responsable Achats', 'Commercial B2B', 'Directeur Financier',
  'Responsable Opérations', 'Responsable RH', 'Cheffe de Produit', 'Responsable IT',
  'Juriste', 'Responsable Marketing', 'Responsable Logistique', 'Responsable Qualité',
  'Responsable Support', 'Ingénieur Systèmes', 'Auditeur Interne', 'Responsable Communication',
  'Contrôleur de Gestion',
]

interface EmployeeSpec {
  firstName: string
  lastName: string
  roleIndex: number
  departmentIndex: number
  status: 'active' | 'leaving' | 'onboarding'
  memories: number
  tenureYears: number
  startDate: string
}

const NAMED_EMPLOYEES: EmployeeSpec[] = [
  { firstName: 'Moussa', lastName: 'Koné', roleIndex: 0, departmentIndex: 0, status: 'leaving', memories: 1284, tenureYears: 5, startDate: 'Mars 2021' },
  { firstName: 'Awa', lastName: 'Traoré', roleIndex: 6, departmentIndex: 5, status: 'active', memories: 942, tenureYears: 6, startDate: 'Janvier 2020' },
  { firstName: 'Fatou', lastName: 'Kouassi', roleIndex: 1, departmentIndex: 4, status: 'active', memories: 846, tenureYears: 4, startDate: 'Juin 2022' },
  { firstName: 'Ibrahim', lastName: 'Diallo', roleIndex: 3, departmentIndex: 2, status: 'active', memories: 1103, tenureYears: 7, startDate: 'Septembre 2019' },
  { firstName: 'Yann', lastName: 'Kouamé', roleIndex: 0, departmentIndex: 0, status: 'onboarding', memories: 0, tenureYears: 0, startDate: '21 septembre' },
  { firstName: 'Mariama', lastName: 'Touré', roleIndex: 5, departmentIndex: 3, status: 'active', memories: 612, tenureYears: 3, startDate: 'Août 2023' },
  { firstName: 'Koffi', lastName: "N'Guessan", roleIndex: 4, departmentIndex: 1, status: 'active', memories: 731, tenureYears: 6, startDate: 'Février 2020' },
  { firstName: 'Aïcha', lastName: 'Diarra', roleIndex: 2, departmentIndex: 0, status: 'active', memories: 508, tenureYears: 2, startDate: 'Mai 2024' },
]

const HANDCRAFTED_MEMORIES = [
  {
    type: 'procedure' as const, scope: 'employee' as const, owner: 'Moussa Koné',
    title: 'Faire valider tout dossier Orange CI par Ibrahim avant soumission',
    content: "Avant toute soumission à Orange Côte d'Ivoire, le dossier commercial doit être validé par Ibrahim Diallo (Direction Financière). La validation porte sur la marge plancher, les conditions de paiement et la conformité aux exigences de l'acheteur. Un dossier non validé ne peut pas être transmis, même en cas de délai court : prévoir 48 h ouvrées entre la remise du dossier et la validation.",
    confidence: 94, importance: 92, status: 'verified' as const,
  },
  {
    type: 'procedure' as const, scope: 'role' as const, owner: 'Moussa Koné',
    title: "Préparer un appel d'offres public — dossier type",
    content: "Pour chaque appel d'offres public : 1) rassembler l'attestation de conformité fiscale de moins de 3 mois, les attestations bancaires et les références signées des trois derniers projets similaires ; 2) préparer le cautionnement de 2 % du montant proposé ; 3) déposer via la plateforme fournisseurs (jamais par email) ; 4) faire relire la note technique par le responsable de rôle ; 5) valider la marge avec la Direction Financière avant remise. Un dossier modèle prêt à copier est conservé dans le drive Commercial.",
    confidence: 90, importance: 95, status: 'verified' as const,
  },
  {
    type: 'fact' as const, scope: 'role' as const, owner: 'Moussa Koné',
    title: 'Exigences de conformité Orange CI',
    content: "Orange Côte d'Ivoire exige trois pièces pour tout appel d'offres : attestation de conformité fiscale de moins de 3 mois, références de projets équivalents signées, et cautionnement de 2 % du montant proposé. Le dossier doit être déposé via la plateforme fournisseurs, jamais par email.",
    confidence: 88, importance: 84, status: 'active' as const,
  },
  {
    type: 'decision' as const, scope: 'role' as const, owner: 'Moussa Koné',
    title: 'Migration du compte SOTRA vers le modèle de facturation trimestrielle',
    content: "Décision du comité de direction (juin 2026) : la facturation SOTRA passe de mensuelle à trimestrielle pour réduire le coût administratif, malgré la réserve de leur service financier. Compensé par un escompte de 1,5 % accordé à partir du 2e trimestre.",
    confidence: 91, importance: 78, status: 'verified' as const,
  },
  {
    type: 'relationship' as const, scope: 'employee' as const, owner: 'Moussa Koné',
    title: 'Engagements informels SOTRA — préavis tarifaire et trêve',
    content: "SOTRA : engagement verbal de prévenir 15 jours avant toute modification tarifaire, même si le contrat ne le prévoit pas. Trêve de fin d'année : aucune opération menée chez le client sans accord préalable de M. Bakayoko. Décideur réel : direction technique réseau.",
    confidence: 85, importance: 88, status: 'active' as const,
  },
  {
    type: 'lesson' as const, scope: 'role' as const, owner: 'Moussa Koné',
    title: 'Les délais SOTRA sous-estimés en période de paie',
    content: "Chaque fin de mois de paie, les validations internes de SOTRA prennent 5 à 7 jours de plus que prévu. Prévoir systématiquement ce délai dans tout engagement contractuel avec SOTRA.",
    confidence: 84, importance: 62, status: 'verified' as const,
  },
  {
    type: 'procedure' as const, scope: 'role' as const, owner: "Koffi N'Guessan",
    title: 'Connexion des compteurs prépayés CIE — procédure terrain',
    content: "Étapes : vérifier le code compteur, réinitialiser via le portail CIE, confirmer la reprise au client sous 2 h. Aucune manipulation sans ticket associé. En cas d'échec après réinitialisation, escalader au Responsable Opérations.",
    confidence: 90, importance: 58, status: 'verified' as const,
  },
  {
    type: 'procedure' as const, scope: 'role' as const, owner: "Koffi N'Guessan",
    title: 'Processus SAV — traitement des réclamations (version A)',
    content: "Toute réclamation client ouvre un ticket prioritaire. Le délai de première réponse est de 4 h ouvrées. Les réclamations de plus de 500 000 FCFA sont escaladées au Responsable Opérations avant toute réponse définitive.",
    confidence: 72, importance: 88, status: 'contradicted' as const,
  },
  {
    type: 'procedure' as const, scope: 'employee' as const, owner: "Koffi N'Guessan",
    title: 'Processus SAV — traitement des réclamations (version B)',
    content: "Les réclamations de plus de 250 000 FCFA sont escaladées au Responsable Opérations. Le délai de première réponse reste de 4 h ouvrées, mais le ticket est traité par l'équipe support sans priorité système.",
    confidence: 61, importance: 70, status: 'contradicted' as const,
  },
  {
    type: 'decision' as const, scope: 'employee' as const, owner: 'Moussa Koné',
    title: 'Validation des remises exceptionnelles supérieures à 15 %',
    content: "Information contradictoire : la note de 2023 indique que toute remise supérieure à 15 % nécessite la validation du Directeur Financier. Une note plus récente de Moussa évoque une validation directe par la Direction Générale au-delà de 15 %.",
    confidence: 42, importance: 86, status: 'contradicted' as const,
  },
  {
    type: 'relationship' as const, scope: 'employee' as const, owner: 'Fatou Kouassi',
    title: 'Réseau fournisseurs — Fatou Kouassi',
    content: "Fatou entretient la relation avec les 14 fournisseurs critiques (matériel informatique, transport, imprimerie). Elle est le seul point de contact pour 73 % de ce savoir : historiques de négociation, conditions hors contrat, interlocuteurs internes des fournisseurs.",
    confidence: 89, importance: 95, status: 'active' as const,
  },
  {
    type: 'preference' as const, scope: 'employee' as const, owner: 'Aïcha Diarra',
    title: 'NSIA — préférences de communication',
    content: "Le service achats de NSIA préfère les échanges par email formel avec copie à la direction. Les appels directs sont réservés aux urgences. Les propositions doivent être en français, format PDF, sans logo animé.",
    confidence: 81, importance: 55, status: 'active' as const,
  },
  {
    type: 'project' as const, scope: 'employee' as const, owner: "Koffi N'Guessan",
    title: 'Migration ERP SOTRA — contexte et décisions clés',
    content: "Projet de migration du parc applicatif SOTRA (phase pilote). Périmètre : facturation et stocks. Décision clé : bascule par agence pilote avant déploiement national. Le planning intègre la trêve de fin d'année.",
    confidence: 87, importance: 74, status: 'active' as const,
  },
  {
    type: 'fact' as const, scope: 'employee' as const, owner: 'Ibrahim Diallo',
    title: 'Ecobank — conditions cadre 2026',
    content: "L'accord cadre avec Ecobank fixe le délai de paiement à 30 jours, une remise volume de 4 % et un engagement de support prioritaire. Toute dérogation doit être validée par la Direction Financière.",
    confidence: 93, importance: 68, status: 'verified' as const,
  },
  {
    type: 'procedure' as const, scope: 'role' as const, owner: 'Mariama Touré',
    title: "Parcours d'intégration des nouveaux commerciaux",
    content: "Jour 1 : présentation du Role Brain, lecture des procédures critiques, création des accès. Semaine 1 : shadowing des appels clients, quiz de connaissance. Semaine 2 : first deal supervisé.",
    confidence: 92, importance: 64, status: 'verified' as const,
  },
]

const GEN_TEMPLATES: { type: string; titles: string[]; content: (topic: string) => string }[] = [
  {
    type: 'procedure',
    titles: ['Procédure — {t} : traitement standard', 'Procédure — {t} : contrôle avant clôture', 'Procédure — {t} : escalade et exceptions'],
    content: (t) => `Procédure standard pour ${t} : vérifier les données d'entrée, appliquer la checklist interne, faire valider par le responsable avant transmission, puis archiver la preuve dans le dossier partagé. Toute exception doit être escaladée sous 24 h avec un compte-rendu écrit.`,
  },
  {
    type: 'decision',
    titles: ['Décision — choix fournisseur pour {t}', 'Décision — arbitrage budgétaire sur {t}', 'Décision — report planifié de {t}'],
    content: (t) => `Décision arbitrée en comité concernant ${t} : le choix retenu privilégie la continuité de service et le coût total sur 12 mois. Rationale documentée : risque opérationnel trop élevé sur l'alternative, validation de la Direction concernée obtenue.`,
  },
  {
    type: 'fact',
    titles: ['Référence — conditions applicables à {t}', 'Référence — délais et seuils pour {t}', 'Référence — cadre contractuel de {t}'],
    content: (t) => `Cadre de référence pour ${t} : délai standard de traitement, seuils d'escalade et conditions applicables fixées en début d'année. Toute dérogation demande une validation écrite du responsable du domaine.`,
  },
  {
    type: 'lesson',
    titles: ['Leçon — piège à éviter sur {t}', 'Leçon — retour d\'expérience sur {t}'],
    content: (t) => `Leçon retenue sur ${t} : les délais réels dépassent le prévisionnel en période de forte activité. Prévoir systématiquement une marge de sécurité et confirmer les engagements critiques par écrit.`,
  },
  {
    type: 'relationship',
    titles: ['Relation — interlocuteurs {t}', 'Relation — historique du compte {t}'],
    content: (t) => `Relations autour de ${t} : interlocuteurs principaux identifiés, historique des échanges conservé, engagements en cours documentés. Le suivi régulier conditionne la qualité de la relation.`,
  },
  {
    type: 'preference',
    titles: ['Préférence — mode de fonctionnement pour {t}'],
    content: (t) => `Fonctionnement établi pour ${t} : canaux de communication privilégiés, format des livrables et fréquence de revue convenus avec les parties prenantes. Respecter ce cadre évite les allers-retours inutiles.`,
  },
  {
    type: 'project',
    titles: ['Projet — volet {t}', 'Projet — phase pilote {t}'],
    content: (t) => `Projet ${t} : objectifs, jalons et dépendances documentés. Phase en cours suivie en comité; les changements de périmètre passent par une validation formelle.`,
  },
]

const GEN_TOPICS = [
  'les facturations récurrentes', 'les appels entrants', 'le parc matériel', 'les contrats cadre',
  'les réclamations simples', 'le reporting mensuel', 'les audits internes', 'les livraisons Abidjan',
  'les commandes fournisseurs', 'les notes de frais', 'le recrutement local', 'la paie intersites',
  'les licences logicielles', 'les accès VPN', 'le courrier officiel', 'les relances clients',
  'les inventaires trimestriels', 'les formations obligatoires', 'les badges et accès', 'la veille concurrentielle',
  'les contrôles qualité', 'les transports inter-sites', 'les assurances', 'les marchés publics',
  'les partenaires locaux', 'la facturation électronique', 'les sauvegardes', 'le support niveau 1',
]

export async function seedDatabase(dbh: DbHandle) {
  // Idempotent: skip when already seeded unless forced via ?force.
  const existing = await dbh.query<{ cnt: string }>(`SELECT count(*)::text AS cnt FROM organizations WHERE slug = 'kamaloka'`)
  if (Number(existing[0]?.cnt ?? 0) > 0) {
    return { seeded: false, reason: 'déjà initialisé' }
  }

  // 1. Organization
  const [org] = await dbh.db.insert(await orgTable()).values({
    name: 'Kamaloka AI',
    slug: 'kamaloka',
    sector: 'Services professionnels',
    country: "Côte d'Ivoire",
    instanceUrl: 'brain.kamaloka.local',
  }).returning()

  // 2. Departments
  const deptIds: Record<string, string> = {}
  for (const name of DEPARTMENTS) {
    const [d] = await dbh.db.insert(await deptTable()).values({ organizationId: org.id, name }).returning()
    deptIds[name] = d.id
  }

  // 3. Roles
  const roleIds: string[] = []
  for (const [i, title] of ROLE_TITLES.entries()) {
    const [r] = await dbh.db.insert(await roleTable()).values({
      organizationId: org.id,
      departmentId: deptIds[DEPARTMENTS[Math.min(i, DEPARTMENTS.length - 1)]],
      title,
      coverageTarget: 90,
    }).returning()
    roleIds.push(r.id)
  }

  // 4. Employees — 8 named + synthetic to reach 42
  const employeeRows: { id: string; name: string; roleId: string; deptId: string }[] = []
  const employeesSpecs: EmployeeSpec[] = [...NAMED_EMPLOYEES]
  let ni = 0
  let li = 0
  while (employeesSpecs.length < 42) {
    const roleIndex = employeesSpecs.length % ROLE_TITLES.length
    employeesSpecs.push({
      firstName: FIRST_NAMES[ni++ % FIRST_NAMES.length],
      lastName: LAST_NAMES[li++ % LAST_NAMES.length],
      roleIndex,
      departmentIndex: roleIndex % DEPARTMENTS.length,
      status: 'active',
      memories: 180 + Math.floor(rand() * 260),
      tenureYears: 1 + Math.floor(rand() * 5),
      startDate: '2023',
    })
  }

  const passwordHash = await bcrypt.hash('companion', 10)
  let moussaId = ''
  let yannId = ''
  for (const spec of employeesSpecs) {
    const email = `${spec.firstName.toLowerCase().replace(/[^a-z]/g, '')}.${spec.lastName.toLowerCase().replace(/[^a-z]/g, '')}@kamaloka.ci`
    const [e] = await dbh.db.insert(await empTable()).values({
      organizationId: org.id,
      roleId: roleIds[spec.roleIndex],
      departmentId: deptIds[DEPARTMENTS[spec.departmentIndex]],
      firstName: spec.firstName,
      lastName: spec.lastName,
      email,
      status: spec.status,
      startDate: spec.startDate,
      seniorityMonths: spec.tenureYears * 12,
    }).returning()
    employeeRows.push({ id: e.id, name: `${spec.firstName} ${spec.lastName}`, roleId: roleIds[spec.roleIndex], deptId: deptIds[DEPARTMENTS[spec.departmentIndex]] })
    if (spec.firstName === 'Moussa') moussaId = e.id
    if (spec.firstName === 'Yann') yannId = e.id
  }

  // 5. Users — Ange (owner) + Moussa (manager) + an auditor
  const [angeUser] = await dbh.db.insert(await usersTable()).values({
    organizationId: org.id,
    email: 'ange.niamke@kamaloka.ci',
    passwordHash,
    name: 'Ange Niamké',
    appRole: 'owner',
    employeeId: null,
  }).returning()
  await dbh.db.insert(await usersTable()).values({
    organizationId: org.id,
    email: 'moussa.kone@kamaloka.ci',
    passwordHash,
    name: 'Moussa Koné',
    appRole: 'manager',
    employeeId: moussaId,
  })
  await dbh.db.insert(await usersTable()).values({
    organizationId: org.id,
    email: 'audit@kamaloka.ci',
    passwordHash,
    name: 'Auditeur Interne',
    appRole: 'auditor',
    employeeId: null,
  })

  // 6. Handcrafted memories — the demo backbone, with embeddings
  const byName = new Map(employeeRows.map((e) => [e.name, e]))
  let handcrafted = 0
  for (const m of HANDCRAFTED_MEMORIES) {
    const empRow = byName.get(m.owner)
    await createMemory(dbh, {
      organizationId: org.id,
      type: m.type,
      title: m.title,
      content: m.content,
      scope: m.scope,
      employeeId: empRow?.id ?? null,
      roleId: empRow?.roleId ?? null,
      departmentId: empRow?.deptId ?? null,
      confidence: m.confidence,
      importance: m.importance,
      status: m.status,
      validFrom: '2026',
      contributor: m.owner,
      origin: 'human',
      humanValidated: m.status === 'verified',
      changedBy: 'seed',
      skipDedup: true,
    })
    handcrafted++
  }

  // 7. Generated memories — deterministic, to reach the exact demo totals.
  // Budget: 12 842 total. 15 handcrafted. Named employees fill up to their demo
  // counts, former contributors fill the role archives, synthetic employees take
  // the remainder — so every screen keeps coherent numbers.
  // Total cible : 12 842 sur PostgreSQL réel ; réduit sur PGlite (WASM limité
  // en mémoire) — tous les compteurs nommés sont mis à l'échelle, la cohérence
  // inter-écrans reste garantie car chaque écran lit la base.
  const TOTAL_TARGET = Number(process.env.SEED_TOTAL ?? (dbh.driver === 'pglite' ? 4000 : 12842))
  const SCALE = TOTAL_TARGET / 12842
  let generated = 0
  let embeddingBudget = 400 // embed only a subset; the rest are lexical archive rows

  interface QueueItem {
    organizationId: string; type: string; title: string; content: string; scope: string;
    employeeId: string; roleId: string; departmentId: string; confidence: number;
    importance: number; status: string; contributor: string; origin: string; createdOffsetDays: number;
  }
  const memoryQueue: QueueItem[] = []
  let titleSeq = 0

  function makeItem(employee: { id: string; name: string; roleId: string; deptId: string }, daysAgo: number, scope: string): QueueItem {
    const tpl = pick(GEN_TEMPLATES)
    const topic = pick(GEN_TOPICS)
    titleSeq += 1
    return {
      organizationId: org.id,
      type: tpl.type,
      title: `${pick(tpl.titles).replace('{t}', topic)}${titleSeq > 200 ? ` — ${titleSeq}` : ''}`,
      content: tpl.content(topic),
      scope,
      employeeId: employee.id,
      roleId: employee.roleId,
      departmentId: employee.deptId,
      confidence: 55 + Math.floor(rand() * 40),
      importance: 25 + Math.floor(rand() * 60),
      status: rand() < 0.55 ? 'active' : 'verified',
      contributor: employee.name,
      origin: 'human',
      createdOffsetDays: daysAgo,
    }
  }

  const handcraftedByOwner = new Map<string, number>()
  for (const m of HANDCRAFTED_MEMORIES) {
    handcraftedByOwner.set(m.owner, (handcraftedByOwner.get(m.owner) ?? 0) + 1)
  }

  // 7a. Named employees — up to their exact demo counts.
  const namedNames = new Set(NAMED_EMPLOYEES.map((s) => `${s.firstName} ${s.lastName}`))
  for (const spec of employeesSpecs.filter((s) => namedNames.has(`${s.firstName} ${s.lastName}`))) {
    const emp = employeeRows.find((e) => e.name === `${spec.firstName} ${spec.lastName}`)!
    const already = handcraftedByOwner.get(emp.name) ?? 0
    const toGenerate = Math.max(0, Math.round(spec.memories * SCALE) - already)
    for (let i = 0; i < toGenerate; i++) {
      memoryQueue.push(makeItem(emp, Math.floor(rand() * Math.max(30, spec.tenureYears * 365)), rand() < 0.7 ? 'role' : 'company'))
    }
  }

  // 7b. Role archives — former contributors fill roles up to their demo totals.
  const roleCurrentCounts = new Map<string, number>()
  for (const m of memoryQueue) roleCurrentCounts.set(m.roleId, (roleCurrentCounts.get(m.roleId) ?? 0) + 1)
  const roleIndexToId = new Map(roleIds.map((id, i) => [i, id]))
  const roleTargets: Record<number, number> = { 0: 3428, 2: 1877, 4: 1462 }
  const formerNames = ['Karim Diallo', 'Sylvie Bamba', 'Bernard Adjovi', 'Paul Mensah', 'Christine Yao']
  for (const [ri, target] of Object.entries(roleTargets)) {
    const roleId = roleIndexToId.get(Number(ri))!
    const current = roleCurrentCounts.get(roleId) ?? 0
    const toAdd = Math.max(0, Math.round(Number(target) * SCALE) - current)
    for (let i = 0; i < toAdd; i++) {
      const item = makeItem(employeeRows[0], 400 + Math.floor(rand() * 1200), 'role')
      item.contributor = formerNames[i % formerNames.length]
      item.roleId = roleId
      memoryQueue.push(item)
    }
  }

  // 7c. Synthetic employees share whatever remains up to the exact 12 842 target.
  const synthetic = employeeRows.filter((e) => !NAMED_EMPLOYEES.some((s) => `${s.firstName} ${s.lastName}` === e.name))
  const remaining = TOTAL_TARGET - handcrafted - memoryQueue.length
  const perSynthetic = Math.max(0, Math.floor(remaining / Math.max(1, synthetic.length)))
  let leftover = remaining - perSynthetic * synthetic.length
  for (const emp of synthetic) {
    const n = perSynthetic + (leftover > 0 ? 1 : 0)
    if (leftover > 0) leftover--
    for (let i = 0; i < n; i++) {
      memoryQueue.push(makeItem(emp, Math.floor(rand() * 900), rand() < 0.5 ? 'role' : 'company'))
    }
  }

  // 7d. Safety trim — never exceed the exact demo total.
  const maxQueue = TOTAL_TARGET - handcrafted
  if (memoryQueue.length > maxQueue) {
    memoryQueue.length = maxQueue
  }

  // Bulk insert in batches of 50 (archive rows without embeddings; the most
  // important ones get a real vector up to the embedding budget).
  const BATCH = 50
  for (let start = 0; start < memoryQueue.length; start += BATCH) {
    const batch = memoryQueue.slice(start, start + BATCH)
    const values: string[] = []
    for (const m of batch) {
      const createdAt = new Date(Date.now() - m.createdOffsetDays * 86_400_000).toISOString()
      let embeddingSql = 'NULL'
      if (embeddingBudget > 0 && m.importance >= 60) {
        const { vector } = await embed(`${m.title}\n${m.content}`)
        embeddingSql = `'${toPgVectorLiteral(vector)}'::vector`
        embeddingBudget--
      }
      values.push(
        `('${m.organizationId}', '${m.type}', '${esc(m.title)}', '${esc(m.content)}', '${m.scope}', '${m.employeeId}', '${m.roleId}', '${m.departmentId}', '${m.status}', ${m.confidence}, ${m.importance}, '2024', '${esc(m.contributor)}', 'human', true, ${embeddingSql}, ${embeddingSql === 'NULL' ? 'NULL' : "'local-hash'"}, '${createdAt}', '${createdAt}')`,
      )
    }
    await dbh.exec(`
      INSERT INTO memories (organization_id, type, title, content, scope, employee_id, role_id, department_id,
        status, confidence, importance, valid_from, contributor, origin, human_validated, embedding, embedding_provider, created_at, updated_at)
      VALUES ${values.join(',')}
    `)
    generated += batch.length
  }

  // Versions for the handcrafted ones already exist via createMemory.

  await audit(dbh, org.id, {
    actorName: 'seed',
    actorKind: 'system',
    action: 'system.seed',
    detail: { employees: employeeRows.length, handcrafted, generated, totalMemories: handcrafted + generated },
  })

  return {
    seeded: true,
    organization: org.name,
    employees: employeeRows.length,
    roles: roleIds.length,
    handcraftedMemories: handcrafted,
    generatedMemories: generated,
    totalMemories: handcrafted + generated,
    login: 'ange.niamke@kamaloka.ci / companion',
  }
}

// Table accessors kept as functions to avoid duplicate import lists drifting.
async function orgTable() {
  const { organizations } = await import('./db/schema.js')
  return organizations
}
async function deptTable() {
  const { departments } = await import('./db/schema.js')
  return departments
}
async function roleTable() {
  const { roles } = await import('./db/schema.js')
  return roles
}
async function empTable() {
  const { employees } = await import('./db/schema.js')
  return employees
}
async function usersTable() {
  const { users } = await import('./db/schema.js')
  return users
}

function esc(s: string): string {
  return s.replace(/'/g, "''").replace(/\\/g, '\\\\')
}
