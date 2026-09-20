import type {
  SourceConnection,
  IngestionRecord,
  Agent,
  Automation,
  Approval,
  ActivityEvent,
  AppNotification,
  Integration,
  McpTool,
  Client,
  Project,
} from '@/types'

/* ------------------------------- Sources -------------------------------- */

export const SOURCES: SourceConnection[] = [
  { id: 'src-drive', kind: 'drive', name: 'Google Drive', status: 'connected', detail: 'Kamaloka AI — Drive partagé', files: 1842, lastSync: 'Il y a 12 min' },
  { id: 'src-gmail', kind: 'gmail', name: 'Gmail', status: 'connected', detail: 'domaine kamaloka.ci — 12 boîtes', files: 640, lastSync: 'Il y a 8 min' },
  { id: 'src-m365', kind: 'm365', name: 'Microsoft 365', status: 'disconnected', detail: 'Connexion expirée — reconnecter', files: 210, lastSync: 'Il y a 15 j' },
  { id: 'src-notion', kind: 'notion', name: 'Notion', status: 'connected', detail: 'Espace Kamaloka — 84 pages', files: 84, lastSync: 'Il y a 1 h' },
  { id: 'src-slack', kind: 'slack', name: 'Slack', status: 'disconnected', detail: 'Déconnecté par un administrateur', files: 0, lastSync: '—' },
  { id: 'src-whatsapp', kind: 'whatsapp', name: 'WhatsApp Business', status: 'available', detail: 'Connexion en attente de configuration', lastSync: '—' },
  { id: 'src-local', kind: 'local', name: 'Fichiers locaux', status: 'connected', detail: 'Dossier surveillé — /data/sources', files: 148, lastSync: 'Il y a 4 min' },
  { id: 'src-crm', kind: 'crm', name: 'CRM', status: 'connected', detail: 'Pipeline commercial + fiches clients', files: 312, lastSync: 'Il y a 26 min' },
]

export const INGESTIONS: IngestionRecord[] = [
  { id: 'ing-1', sourceName: 'Compte-rendu commercial.pdf', type: 'Fichier local', ownerName: 'Moussa Koné', imported: 'Il y a 2 h', memoriesExtracted: 17, status: 'complete' },
  { id: 'ing-2', sourceName: 'Notion — Processus achats', type: 'Notion', ownerName: 'Fatou Kouassi', imported: 'Il y a 3 h', memoriesExtracted: 9, status: 'complete' },
  { id: 'ing-3', sourceName: 'Gmail — Dossier Orange CI', type: 'Gmail', ownerName: 'Moussa Koné', imported: 'Il y a 5 h', memoriesExtracted: 6, status: 'partial' },
  { id: 'ing-4', sourceName: 'CRM — Synchronisation hebdo', type: 'CRM', ownerName: 'Système', imported: 'Hier', memoriesExtracted: 22, status: 'complete' },
  { id: 'ing-5', sourceName: 'Drive — RH / Intégration', type: 'Google Drive', ownerName: 'Mariama Touré', imported: 'Hier', memoriesExtracted: 4, status: 'complete' },
  { id: 'ing-6', sourceName: 'Microsoft 365 — SharePoint', type: 'Microsoft 365', ownerName: 'Système', imported: 'Il y a 15 j', memoriesExtracted: 0, status: 'failed' },
]

/* ------------------------------- Agents --------------------------------- */

export const AGENTS: Agent[] = [
  {
    id: 'agent-knowledge',
    name: 'Knowledge Agent',
    description: 'Lit les nouvelles sources, extrait les connaissances candidates, détecte les doublons et les contradictions.',
    goal: 'Transformer chaque source importée en connaissances fiables, dédupliquées et sourcées.',
    status: 'running',
    autonomy: 'autopilot',
    lastActivity: 'Il y a 2 min',
    skills: ['Extraction de connaissances', 'Détection de doublons', 'Détection de contradictions', 'Notation de confiance'],
    tools: ['Google Drive', 'Gmail', 'Notion', 'Fichiers locaux'],
    memoryAccess: [
      { scope: 'Entreprise', kind: 'company', allowed: true },
      { scope: 'Commercial', kind: 'department', allowed: true },
      { scope: 'Role Brain — Commercial', kind: 'role-brain', allowed: true },
      { scope: 'Finance', kind: 'department', allowed: true },
      { scope: 'RH', kind: 'department', allowed: true },
    ],
    permissions: [
      { action: 'Créer une mémoire candidate', mode: 'automatic' },
      { action: 'Confirmer une mémoire', mode: 'approval' },
      { action: 'Mettre à jour une mémoire', mode: 'approval' },
      { action: 'Archiver une mémoire', mode: 'approval' },
      { action: 'Supprimer des données', mode: 'blocked' },
    ],
    recent: [
      { id: 'ka-1', time: 'Il y a 2 min', detail: '17 nouvelles connaissances extraites du compte-rendu commercial.pdf.', kind: 'knowledge' },
      { id: 'ka-2', time: 'Il y a 26 min', detail: 'Analyse de la synchronisation CRM hebdomadaire terminée.', kind: 'knowledge' },
      { id: 'ka-3', time: 'Il y a 3 j', detail: 'Conflit détecté sur le processus SAV — escaladé en revue.', kind: 'knowledge' },
    ],
  },
  {
    id: 'agent-handover',
    name: 'Handover Agent',
    description: 'Analyse les postes, détecte les connaissances uniques, mène les entretiens de transfert et construit les handovers.',
    goal: 'Garantir la continuité de chaque poste avant un départ.',
    status: 'running',
    autonomy: 'copilot',
    lastActivity: 'Il y a 11 min',
    skills: ['Analyse de poste', 'Détection de connaissances uniques', 'Entretien de connaissances', 'Construction de handover'],
    tools: ['Company Brain', 'CRM', 'Gmail'],
    memoryAccess: [
      { scope: 'Entreprise', kind: 'company', allowed: true },
      { scope: 'Commercial', kind: 'department', allowed: true },
      { scope: 'Role Brain — Commercial', kind: 'role-brain', allowed: true },
      { scope: 'Finance', kind: 'department', allowed: false },
      { scope: 'RH', kind: 'department', allowed: false },
    ],
    permissions: [
      { action: 'Préparer un entretien', mode: 'automatic' },
      { action: 'Créer une mémoire candidate', mode: 'automatic' },
      { action: 'Envoyer une invitation entretien', mode: 'approval' },
      { action: 'Supprimer des données', mode: 'blocked' },
    ],
    recent: [
      { id: 'ha-1', time: 'Il y a 11 min', detail: 'Analyse du poste de Moussa Koné terminée — 6 lacunes détectées.', kind: 'handover' },
      { id: 'ha-2', time: 'Il y a 1 j', detail: 'Entretien de connaissances 5/9 complété avec Moussa.', kind: 'handover' },
    ],
  },
  {
    id: 'agent-onboarding',
    name: 'Onboarding Agent',
    description: 'Génère des parcours dintégration personnalisés à partir du Role Brain et des handovers.',
    goal: 'Rendre chaque nouvel employé opérationnel à partir de la mémoire du rôle.',
    status: 'idle',
    autonomy: 'copilot',
    lastActivity: 'Il y a 23 min',
    skills: ['Génération de parcours', 'Quiz de connaissance', 'Suivi de progression'],
    tools: ['Role Brain', 'Company Brain', 'Handovers'],
    memoryAccess: [
      { scope: 'Entreprise', kind: 'company', allowed: true },
      { scope: 'Role Brain — Commercial', kind: 'role-brain', allowed: true },
      { scope: 'Finance', kind: 'department', allowed: false },
      { scope: 'RH', kind: 'department', allowed: true },
    ],
    permissions: [
      { action: 'Générer un parcours', mode: 'automatic' },
      { action: 'Envoyer un email de bienvenue', mode: 'approval' },
      { action: 'Supprimer des données', mode: 'blocked' },
    ],
    recent: [
      { id: 'oa-1', time: 'Il y a 23 min', detail: 'Parcours de Yann Kouamé généré (92 % de préparation).', kind: 'onboarding' },
    ],
  },
  {
    id: 'agent-sales',
    name: 'Sales Agent',
    description: 'Assiste léquipe commerciale avec le contexte clients approuvé et prépare les relances.',
    goal: 'Assister léquipe commerciale en sappuyant sur la mémoire organisationnelle validée.',
    status: 'running',
    autonomy: 'copilot',
    lastActivity: 'Il y a 38 min',
    skills: ['Contexte client', 'Préparation d’emails', 'Suivi de pipeline', 'Préparation d’appels d’offres'],
    tools: ['CRM', 'Gmail', 'Calendar', 'Google Drive'],
    memoryAccess: [
      { scope: 'Entreprise', kind: 'company', allowed: true },
      { scope: 'Commercial', kind: 'department', allowed: true },
      { scope: 'Role Brain — Commercial', kind: 'role-brain', allowed: true },
      { scope: 'Finance', kind: 'department', allowed: false },
      { scope: 'RH', kind: 'department', allowed: false },
    ],
    permissions: [
      { action: 'Préparer un email', mode: 'automatic' },
      { action: 'Créer une tâche', mode: 'automatic' },
      { action: 'Mettre à jour le CRM', mode: 'automatic' },
      { action: 'Envoyer un email', mode: 'approval' },
      { action: 'Supprimer des données', mode: 'blocked' },
      { action: 'Signer un contrat', mode: 'blocked' },
    ],
    recent: [
      { id: 'sa-1', time: 'Il y a 38 min', detail: 'Contexte client SOTRA actualisé après le comité de projet ERP.', kind: 'sales' },
      { id: 'sa-2', time: 'Il y a 29 min', detail: 'Demande d’approbation envoyée — relance Orange CI.', kind: 'sales' },
    ],
  },
  {
    id: 'agent-operations',
    name: 'Operations Agent',
    description: 'Surveille les procédures obsolètes et propose des mises à jour.',
    goal: 'Maintenir les procédures opérationnelles à jour et partagées.',
    status: 'paused',
    autonomy: 'assistant',
    lastActivity: 'Il y a 2 j',
    skills: ['Veille de procédures', 'Détection d’obsolescence'],
    tools: ['Company Brain', 'Fichiers locaux'],
    memoryAccess: [
      { scope: 'Opérations', kind: 'department', allowed: true },
      { scope: 'Entreprise', kind: 'company', allowed: false },
    ],
    permissions: [
      { action: 'Proposer une mise à jour', mode: 'automatic' },
      { action: 'Modifier une procédure', mode: 'approval' },
      { action: 'Supprimer des données', mode: 'blocked' },
    ],
    recent: [
      { id: 'opa-1', time: 'Il y a 2 j', detail: 'Agent mis en pause par un administrateur.', kind: 'operations' },
    ],
  },
]

export function getAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id)
}

/* ----------------------------- Automations ------------------------------- */

export const AUTOMATIONS: Automation[] = [
  { id: 'auto-1', event: 'Le statut dun employé devient « En départ »', action: 'Démarrer le Handover Agent', agentName: 'Handover Agent', status: 'active', runs: 3, lastRun: 'Il y a 2 j' },
  { id: 'auto-2', event: 'Le risque de connaissance dépasse 80 %', action: 'Créer une tâche de capture de connaissance', agentName: 'Knowledge Agent', status: 'active', runs: 5, lastRun: 'Il y a 4 j' },
  { id: 'auto-3', event: 'Un nouvel employé arrive', action: 'Générer un parcours dintégration', agentName: 'Onboarding Agent', status: 'active', runs: 2, lastRun: 'Il y a 1 sem' },
  { id: 'auto-4', event: 'Une nouvelle source est importée', action: 'Faire analyser la source par le Knowledge Agent', agentName: 'Knowledge Agent', status: 'active', runs: 148, lastRun: 'Il y a 2 h' },
]

/* ------------------------------ Approvals -------------------------------- */

export const APPROVALS: Approval[] = [
  {
    id: 'apr-1',
    agentName: 'Sales Agent',
    agentId: 'agent-sales',
    kind: 'action',
    title: 'Envoyer un email à Orange Côte d’Ivoire',
    reason: 'Relance après lenvoi de la proposition, il y a 5 jours. Aucune réponse enregistrée.',
    sources: 3,
    requestedAt: 'Il y a 29 min',
    status: 'pending',
    emailPreview: {
      to: 'achats@orange.ci',
      subject: 'Suivi de notre proposition — extension fibre Abidjan Sud',
      body: 'Bonjour, nous restons à votre disposition concernant la proposition transmise le 10 septembre. Souhaitez-vous que nous planifiions un point cette semaine pour répondre à vos questions ? Cordialement, léquipe commerciale Kamaloka.',
    },
  },
  {
    id: 'apr-2',
    agentName: 'Knowledge Agent',
    agentId: 'agent-knowledge',
    kind: 'memory-update',
    title: 'Mettre à jour le validateur des dossiers fournisseurs',
    reason: 'Deux sources plus récentes confirment le changement de validateur.',
    sources: 2,
    requestedAt: 'Il y a 1 h',
    status: 'pending',
    memoryChange: {
      label: 'Approbateur — Validation des dossiers fournisseurs',
      from: 'Fatou Kouassi',
      to: 'Ibrahim Diallo',
      evidence: '2 sources plus récentes',
    },
  },
  {
    id: 'apr-3',
    agentName: 'Handover Agent',
    agentId: 'agent-handover',
    kind: 'action',
    title: 'Envoyer linvitation dentretien à Moussa Koné',
    reason: '6 lacunes détectées. 3 questions restent à couvrir pour compléter le transfert.',
    sources: 4,
    requestedAt: 'Il y a 2 h',
    status: 'pending',
    emailPreview: {
      to: 'moussa.kone@kamaloka.local',
      subject: 'Compléter le transfert de connaissances — 3 questions',
      body: 'Bonjour Moussa, il reste 3 questions pour compléter ton transfert de connaissances (forecast mensuel, remises exceptionnelles, calendrier des renouvellements). Peux-tu réserver 20 minutes cette semaine ? Merci, Companion.',
    },
  },
]

/* ------------------------------- Activity -------------------------------- */

export const ACTIVITY: ActivityEvent[] = [
  { id: 'act-1', time: '14:32', actor: 'Knowledge Agent', actorKind: 'agent', action: '17 mémoires candidates créées', detail: 'Depuis le compte-rendu commercial.pdf importé par Moussa Koné.', kind: 'knowledge', origin: 'autonomous' },
  { id: 'act-2', time: '14:21', actor: 'Awa Traoré', actorKind: 'user', action: 'Procédure #PROC-392 vérifiée', detail: 'Validation des dossiers Orange CI — confiance portée à 94 %.', kind: 'knowledge', origin: 'verified' },
  { id: 'act-3', time: '14:03', actor: 'Sales Agent', actorKind: 'agent', action: 'Approbation demandée', detail: 'Envoi dun email de relance à Orange Côte d’Ivoire.', kind: 'approvals', origin: 'approval' },
  { id: 'act-4', time: '13:57', actor: 'Ange Niamké', actorKind: 'admin', action: 'Permissions du Sales Agent modifiées', detail: '« Mettre à jour le CRM » passé en automatique.', kind: 'security', origin: 'human' },
  { id: 'act-5', time: '13:40', actor: 'Handover Agent', actorKind: 'agent', action: 'Analyse du poste de Moussa terminée', detail: '6 lacunes détectées — 3 questions restent à couvrir.', kind: 'agents', origin: 'autonomous' },
  { id: 'act-6', time: '13:12', actor: 'Fatou Kouassi', actorKind: 'user', action: 'Source Notion connectée', detail: 'Espace Kamaloka — 84 pages importées.', kind: 'sources', origin: 'human' },
  { id: 'act-7', time: '12:58', actor: 'Onboarding Agent', actorKind: 'agent', action: 'Parcours de Yann Kouamé généré', detail: 'Préparation 92 % — construit depuis le Role Brain et le handover.', kind: 'agents', origin: 'autonomous' },
  { id: 'act-8', time: '11:46', actor: 'Ibrahim Diallo', actorKind: 'user', action: 'Approbation accordée', detail: 'Mise à jour des conditions cadre Ecobank.', kind: 'approvals', origin: 'human' },
  { id: 'act-9', time: '10:31', actor: 'Knowledge Agent', actorKind: 'agent', action: 'Conflit détecté', detail: 'Deux versions contradictoires du processus SAV.', kind: 'knowledge', origin: 'autonomous' },
  { id: 'act-10', time: '09:15', actor: 'Ange Niamké', actorKind: 'admin', action: 'Session ouverte', detail: 'Connexion depuis brain.kamaloka.local.', kind: 'security', origin: 'human' },
]

/* ----------------------------- Notifications ----------------------------- */

export const NOTIFICATIONS: AppNotification[] = [
  { id: 'ntf-1', category: 'knowledge', title: '3 conflits de connaissances demandent une revue', detail: 'Dont deux versions du processus SAV.', time: 'Il y a 3 j', read: false, href: '/brain' },
  { id: 'ntf-2', category: 'agents', title: 'Le handover de Moussa a atteint 92 %', detail: 'Prêt pour la construction du pack final.', time: 'Il y a 11 min', read: false, href: '/handovers/hov-moussa' },
  { id: 'ntf-3', category: 'attention', title: 'Sales Agent attend une approbation', detail: 'Relance client Orange Côte d’Ivoire.', time: 'Il y a 29 min', read: false, href: '/approvals' },
  { id: 'ntf-4', category: 'security', title: 'La synchronisation Google Drive a échoué', detail: 'Nouvelle tentative programmée dans 15 minutes.', time: 'Il y a 1 h', read: true, href: '/integrations' },
]

/* ----------------------------- Integrations ------------------------------ */

export const INTEGRATIONS: Integration[] = [
  { id: 'int-gmail', category: 'communication', name: 'Gmail', description: 'Importe les échanges clients et internes.', status: 'connected', cta: 'Gérer' },
  { id: 'int-outlook', category: 'communication', name: 'Outlook', description: 'Importe les emails et calendriers Microsoft.', status: 'available', cta: 'Connecter' },
  { id: 'int-slack', category: 'communication', name: 'Slack', description: 'Capture les décisions prises dans les canaux.', status: 'disconnected', cta: 'Reconnecter' },
  { id: 'int-teams', category: 'communication', name: 'Teams', description: 'Transcripts et comptes-rendus de réunion.', status: 'available', cta: 'Connecter' },
  { id: 'int-whatsapp', category: 'communication', name: 'WhatsApp Business', description: 'Conversations clients business.', status: 'available', cta: 'Connecter' },
  { id: 'int-drive', category: 'knowledge', name: 'Google Drive', description: 'Documents, feuilles et dossiers partagés.', status: 'connected', cta: 'Gérer' },
  { id: 'int-onedrive', category: 'knowledge', name: 'OneDrive', description: 'Fichiers personnels et partagés Microsoft.', status: 'available', cta: 'Connecter' },
  { id: 'int-notion', category: 'knowledge', name: 'Notion', description: 'Wiki interne et bases de données.', status: 'connected', cta: 'Gérer' },
  { id: 'int-sharepoint', category: 'knowledge', name: 'SharePoint', description: 'Bibliothèques documentaires dentreprise.', status: 'available', cta: 'Connecter' },
  { id: 'int-local', category: 'knowledge', name: 'Fichiers locaux', description: 'Dossier surveillé sur votre serveur.', status: 'connected', cta: 'Gérer' },
  { id: 'int-crm', category: 'business', name: 'CRM', description: 'Pipeline, comptes et contacts.', status: 'connected', cta: 'Gérer' },
  { id: 'int-erp', category: 'business', name: 'ERP', description: 'Facturation, stocks et opérations.', status: 'available', cta: 'Connecter' },
  { id: 'int-hris', category: 'business', name: 'HRIS', description: 'Organigramme, arrivées et départs.', status: 'available', cta: 'Connecter' },
  { id: 'int-ollama', category: 'ai', name: 'Ollama', description: 'Modèles locaux — les données restent sur votre instance.', status: 'connected', cta: 'Gérer' },
  { id: 'int-openai', category: 'ai', name: 'OpenAI', description: 'GPT pour lextraction et la rédaction.', status: 'disconnected', cta: 'Connecter' },
  { id: 'int-anthropic', category: 'ai', name: 'Anthropic', description: 'Claude pour lanalyse de documents.', status: 'disconnected', cta: 'Connecter' },
  { id: 'int-gemini', category: 'ai', name: 'Gemini', description: 'Modèles Google multimodaux.', status: 'available', cta: 'Connecter' },
  { id: 'int-compatible', category: 'ai', name: 'OpenAI Compatible', description: 'Tout point de terminaison compatible OpenAI.', status: 'available', cta: 'Connecter' },
  { id: 'int-mcp', category: 'protocol', name: 'MCP', description: 'Model Context Protocol — Companion comme serveur et client.', status: 'connected', cta: 'Configurer' },
]

/* --------------------------------- MCP ----------------------------------- */

export const MCP_TOOLS: McpTool[] = [
  { name: 'search_memory', description: 'Recherche sémantique dans la mémoire de lentreprise.' },
  { name: 'get_company_context', description: 'Contexte global de lentreprise pour un agent externe.' },
  { name: 'get_employee_context', description: 'Contexte opérationnel dun employé (autorisé uniquement).' },
  { name: 'get_role_context', description: 'Contexte agrégé dun rôle (Role Brain).' },
  { name: 'create_memory', description: 'Crée une mémoire candidate depuis un agent externe.' },
  { name: 'prepare_handover', description: 'Prépare un transfert de connaissances.' },
  { name: 'get_knowledge_gaps', description: 'Liste les lacunes de connaissance détectées.' },
]

export const MCP_CLIENT_SERVERS = [
  { id: 'mcp-crm', name: 'CRM MCP', status: 'connected', detail: 'Outils CRM exposés aux agents Companion' },
  { id: 'mcp-google', name: 'Google Workspace MCP', status: 'connected', detail: 'Gmail, Drive, Calendar' },
  { id: 'mcp-erp', name: 'Custom ERP', status: 'disconnected', detail: 'Serveur MCP interne — hors ligne' },
]

export const MCP_STATS = {
  activeSessions: 4,
  requestsToday: 312,
  authorizedAgents: 6,
}

/* ------------------------------- Clients --------------------------------- */

export const CLIENTS: Client[] = [
  { id: 'cli-orange', name: 'Orange Côte d’Ivoire', industry: 'Télécommunications', ownerName: 'Moussa Koné', contacts: 6, memories: 214, health: 'moderate' },
  { id: 'cli-sotra', name: 'SOTRA', industry: 'Transport', ownerName: 'Moussa Koné', contacts: 4, memories: 186, health: 'low' },
  { id: 'cli-nsia', name: 'NSIA', industry: 'Assurance / Banque', ownerName: 'Aïcha Diarra', contacts: 3, memories: 97, health: 'low' },
  { id: 'cli-cie', name: 'CIE', industry: 'Énergie', ownerName: "Koffi N'Guessan", contacts: 3, memories: 74, health: 'low' },
  { id: 'cli-ecobank', name: 'Ecobank', industry: 'Banque', ownerName: 'Ibrahim Diallo', contacts: 2, memories: 58, health: 'healthy' },
]

export const PROJECTS: Project[] = [
  { id: 'prj-erp-sotra', name: 'Migration ERP SOTRA', clientName: 'SOTRA', status: 'active', ownerName: "Koffi N'Guessan", members: ["Koffi N'Guessan", 'Adama Sanogo', 'Ibrahim Diallo'], updated: 'Il y a 4 j' },
  { id: 'prj-orange-fibre', name: 'Extension fibre Abidjan Sud', clientName: 'Orange Côte d’Ivoire', status: 'at-risk', ownerName: 'Moussa Koné', members: ['Moussa Koné', 'Aïcha Diarra'], updated: 'Il y a 2 j' },
  { id: 'prj-nsia-onboarding', name: 'Déploiement NSIA — phase 1', clientName: 'NSIA', status: 'active', ownerName: 'Aïcha Diarra', members: ['Aïcha Diarra', 'Moussa Koné'], updated: 'Il y a 1 sem' },
  { id: 'prj-cie-compteurs', name: 'Maintenance compteurs CIE', clientName: 'CIE', status: 'closing', ownerName: "Koffi N'Guessan", members: ["Koffi N'Guessan", 'Adama Sanogo'], updated: 'Il y a 3 sem' },
]
