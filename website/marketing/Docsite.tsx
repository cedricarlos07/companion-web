import { useEffect, useState, type ReactNode } from 'react'
import { HugeIcon, adaptIcon } from '@/components/ui/huge-icon'
import { ButtonLink } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { ArrowLeft01Icon, ArrowRight02Icon } from '@/lib/icons'
import logoGreen from './assets/logos/logo-green.png'

/* Documentation — docs.companion.kamaloka.ai. Design system Companion, aucun emoji. */

type Inline = string

type Block =
  | { t: 'p'; c: Inline }
  | { t: 'h2'; c: string }
  | { t: 'ul' | 'ol'; items: Inline[] }
  | { t: 'code'; c: string }
  | { t: 'note'; tone: 'ok' | 'warn' | 'info'; c: Inline }
  | { t: 'table'; head: string[]; rows: string[][] }

interface Article {
  id: string
  kicker: string
  title: string
  blocks: Block[]
}

/* Mini-rendu inline : **gras**, `code`, [texte](#ancre). */
function renderInline(c: Inline): ReactNode {
  const parts = c.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i} className="font-semibold text-text-primary">{p.slice(2, -2)}</strong>
    if (p.startsWith('`') && p.endsWith('`')) return <code key={i} className="rounded-md bg-background-tertiary-default px-1.5 py-0.5 text-caption-1-medium text-text-primary">{p.slice(1, -1)}</code>
    const m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (m) return <a key={i} href={m[2]} className="font-medium text-accent-600 no-underline hover:underline">{m[1]}</a>
    return p
  })
}

function BlockView({ b }: { b: Block }) {
  switch (b.t) {
    case 'p': return <p className="text-body-regular text-text-secondary">{renderInline(b.c)}</p>
    case 'h2': return <h2 className="text-title-3-semibold text-text-primary">{b.c}</h2>
    case 'ul': return <ul className="list-disc space-y-1.5 pl-5">{b.items.map((it, i) => <li key={i} className="text-body-regular text-text-secondary">{renderInline(it)}</li>)}</ul>
    case 'ol': return <ol className="list-decimal space-y-1.5 pl-5">{b.items.map((it, i) => <li key={i} className="text-body-regular text-text-secondary">{renderInline(it)}</li>)}</ol>
    case 'code': return <pre className="overflow-x-auto rounded-xl bg-brand-black p-4 text-caption-1-medium leading-relaxed text-blue-100"><code>{b.c}</code></pre>
    case 'note': {
      const tone = b.tone === 'ok'
        ? 'border-lime-300 bg-lime-100/60 text-lime-800'
        : b.tone === 'warn'
          ? 'border-amber-300 bg-amber-100/60 text-amber-800'
          : 'border-blue-300 bg-blue-100/60 text-blue-800'
      return <div className={`rounded-xl border px-4 py-3 text-body-2-regular ${tone}`}>{renderInline(b.c)}</div>
    }
    case 'table':
      return (
        <div className="overflow-hidden rounded-xl border border-border-table">
          <table className="w-full border-collapse bg-background-primary-default text-left">
            <thead>
              <tr className="bg-background-secondary-default">
                {b.head.map((h) => <th key={h} className="px-4 py-2.5 text-caption-1-medium text-text-tertiary">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i} className="border-t border-separator-border">
                  {row.map((cell, j) => <td key={j} className="px-4 py-2.5 text-body-2-regular text-text-secondary">{renderInline(cell)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

const GAPS = 'space-y-3'

const DOCS: { group: string; articles: Article[] }[] = [
  {
    group: 'Commencer',
    articles: [
      {
        id: 'qu-est-ce-que-companion', kicker: 'Commencer', title: "Qu'est-ce que Companion ?",
        blocks: [
          { t: 'p', c: 'Companion est la **mémoire opérationnelle de votre entreprise**, installée dans votre infrastructure. Il capture le savoir de vos équipes, l\'organise en connaissances vérifiées et sourcées, mesure le risque de perte de savoir, assiste les transmissions de poste et accélère les onboardings — accessible à vos collaborateurs **et** à vos agents IA, avec permissions et audit.' },
          { t: 'h2', c: 'Les concepts en 60 secondes' },
          { t: 'table', head: ['Concept', 'Rôle'], rows: [
            ['**Company Brain**', 'Le socle de connaissances validées de l\'entreprise'],
            ['**Employee Memory**', 'Ce que chaque collaborateur sait — avec provenance'],
            ['**Role Brain**', 'Le savoir du poste, validé et transmissible'],
            ['**Knowledge Risk**', 'Le score de risque de perte de savoir'],
            ['**Handover**', 'Le dossier de transmission de poste'],
            ['**Onboarding**', 'Le plan J1 / J7 / J30 du nouvel arrivant'],
          ]},
          { t: 'note', tone: 'ok', c: 'Companion est **self-hosted** : vos données restent chez vous. Seule la licence est fournie par KamaLoka.' },
          { t: 'p', c: 'Suivant : [Installer Companion en 10 minutes](#installation).' },
        ],
      },
      {
        id: 'installation', kicker: 'Commencer', title: 'Installer Companion en 10 minutes',
        blocks: [
          { t: 'p', c: 'Une machine, quatre commandes. Tout le reste est automatisé.' },
          { t: 'h2', c: '1. Pré-requis' },
          { t: 'table', head: ['Élément', 'Minimum'], rows: [
            ['Serveur', 'Ubuntu 24.04+ (VPS, cloud privé ou interne)'],
            ['CPU / RAM', '4 CPU · 8 Go RAM'],
            ['Disque', '50 Go SSD'],
            ['Logiciel', 'Docker + Docker Compose v2'],
            ['Réseau', 'Un nom de domaine pointant vers le serveur'],
          ]},
          { t: 'h2', c: '2. Installation' },
          { t: 'p', c: 'Récupérez le kit depuis votre [portail client](/portal/login), puis :' },
          { t: 'code', c: 'unzip companion-kit.zip && cd companion-kit\nsudo ./install.sh' },
          { t: 'p', c: 'Le script vérifie les pré-requis, génère vos secrets, démarre la stack complète et enregistre votre licence.' },
          { t: 'note', tone: 'info', c: 'La licence `companion-license.lic` peut être passée au script (`COMPANION_LICENSE_FILE=… ./install.sh`) ou collée à la demande.' },
          { t: 'h2', c: '3. Ouvrir' },
          { t: 'code', c: 'https://companion.votreentreprise.com' },
          { t: 'h2', c: '4. Importer votre licence' },
          { t: 'p', c: 'Paramètres → **Facturation → Importer une licence** : collez le contenu du fichier `.lic`. Votre plan est activé immédiatement, hors-ligne.' },
          { t: 'h2', c: '5. Créer l\'organisation' },
          { t: 'p', c: 'L\'assistant de premier démarrage demande le nom, le secteur, le compte administrateur et invite vos premiers collaborateurs.' },
          { t: 'h2', c: '6. Connecter Google Drive / Microsoft 365' },
          { t: 'p', c: '**Sources → Connecter** : autorisez l\'accès OAuth — l\'ingestion démarre aussitôt, tout est sourcé.' },
          { t: 'note', tone: 'ok', c: '**Terminé.** Posez votre première question dans « Ask Companion » avec la citation de sa source.' },
        ],
      },
      {
        id: 'premier-demarrage', kicker: 'Commencer', title: 'Premier démarrage',
        blocks: [
          { t: 'p', c: 'Après l\'installation, l\'assistant **/setup** crée votre organisation en 5 étapes : organisation (nom, secteur, compte administrateur), intelligence (modèle local par défaut — aucune donnée n\'en sort — ou fournisseur externe BYOK), sources, équipe (invitations par email), terminé (session ouverte).' },
          { t: 'h2', c: 'Les 3 premières actions recommandées' },
          { t: 'ol', items: [
            'Importez 5 à 10 documents représentatifs dans **Sources**.',
            'Posez une question métier dans **Ask Companion** et vérifiez la citation.',
            'Ouvrez **Knowledge Risk** : votre score initial est calculé.',
          ]},
        ],
      },
      {
        id: 'configurer-organisation', kicker: 'Commencer', title: 'Configurer votre organisation',
        blocks: [
          { t: 'h2', c: 'Paramètres → Organisation' },
          { t: 'p', c: 'Nom, secteur, pays — utilisés pour contextualiser les réponses et le vocabulaire métier.' },
          { t: 'h2', c: 'Paramètres → Fournisseurs IA' },
          { t: 'p', c: 'Par défaut, le modèle d\'analyse tourne **sur votre serveur** : aucune donnée ne sort. Vous pouvez brancher un fournisseur externe (OpenAI, Anthropic, Gemini, endpoint compatible) avec votre propre clé — BYOK.' },
          { t: 'h2', c: 'Paramètres → Mémoire' },
          { t: 'p', c: 'Moteur de recherche mémoire : `hybrid` (recommandé), `native` ou `mem0`. L\'état du moteur est affiché en direct.' },
        ],
      },
      {
        id: 'premiere-source', kicker: 'Commencer', title: 'Connecter votre première source',
        blocks: [
          { t: 'ol', items: [
            '**Sources → Nouvelle source**.',
            'Choisissez **Fichiers locaux** (PDF, DOCX, TXT, MD, CSV) — glissez-déposez.',
            'L\'ingestion s\'exécute : extraction → normalisation → découpage → indexation. Chaque fragment garde sa source.',
          ]},
          { t: 'h2', c: 'Qualité d\'ingestion' },
          { t: 'ul', items: [
            'Les documents importés produisent des **candidats** : ils passent « validés » après relecture humaine.',
            'Un doublon n\'est pas créé deux fois ; une contradiction est signalée plutôt qu\'écrasée.',
            'Les sources connectées (Drive, Gmail…) s\'ingèrent en continu.',
          ]},
          { t: 'note', tone: 'info', c: 'Astuce : 10 documents qui font vraiment autorité valent mieux que 1 000 documents en vrac.' },
        ],
      },
    ],
  },
  {
    group: 'Utiliser Companion',
    articles: [
      {
        id: 'company-brain', kicker: 'Utiliser Companion', title: 'Company Brain',
        blocks: [
          { t: 'p', c: 'Le socle de connaissances partagées : procédures, décisions, faits métier. Chaque connaissance porte sa **provenance**, son **statut** et son historique de versions.' },
          { t: 'table', head: ['Statut', 'Signification'], rows: [
            ['`candidate`', 'Détectée ou importée, en attente de validation humaine'],
            ['`verified`', 'Validée par un porteur du savoir — citée avec confiance « Validé »'],
            ['`contested`', 'Contradiction signalée — à arbitrer'],
            ['`deprecated`', 'Obsolète, conservée pour l\'historique'],
          ]},
          { t: 'p', c: 'Les candidats ne deviennent jamais « validées » automatiquement : une main humaine tranche. C\'est ce qui rend les réponses fiables.' },
        ],
      },
      {
        id: 'employee-memory', kicker: 'Utiliser Companion', title: 'Employee Memory',
        blocks: [
          { t: 'p', c: 'Chaque collaborateur dispose d\'une mémoire individuelle, enrichie de trois façons :' },
          { t: 'ul', items: [
            '**Documents** — ce qu\'il écrit est rattaché à sa mémoire ;',
            '**Entretiens de transmission** — les réponses de handover deviennent des candidats ;',
            '**Corrections** — toute correction apportée à une réponse est capturée, pas perdue.',
          ]},
          { t: 'note', tone: 'info', c: 'La mémoire d\'un employé n\'est visible que selon les permissions de chacun — voir [Permissions](#permissions).' },
        ],
      },
      {
        id: 'role-brain', kicker: 'Utiliser Companion', title: 'Role Brain',
        blocks: [
          { t: 'p', c: 'Le savoir **du poste**, pas de la personne : les procédures et connaissances qu\'un titulaire du rôle doit maîtriser.' },
          { t: 'ul', items: [
            'Un **handover** s\'appuie sur le Role Brain pour mesurer ce qui manque ;',
            'Un **onboarding** est construit depuis le Role Brain du poste d\'arrivée ;',
            'Les **agents** s\'appuient sur le contexte du rôle pour agir correctement.',
          ]},
          { t: 'p', c: 'Alimentation : depuis une connaissance validée d\'un employé, **Promouvoir vers un rôle** — la provenance reste chez l\'individu, une copie validée rejoint le rôle.' },
        ],
      },
      {
        id: 'ask-companion', kicker: 'Utiliser Companion', title: 'Ask Companion',
        blocks: [
          { t: 'p', c: 'Posez votre question en français naturel. Companion cherche dans la mémoire (moteur hybride), applique vos permissions, puis répond **avec citations** : document source, propriétaire, niveau de validation.' },
          { t: 'h2', c: 'Les engagements' },
          { t: 'ul', items: [
            '**Citation systématique** — chaque affirmation pointe vers sa source ;',
            '**Abstention honnête** — si le contexte ne suffit pas, Companion dit « je ne sais pas » ;',
            '**Filtres** — rôle, département, employé, type de connaissance ;',
            '**Moteurs** — hybride (défaut), natif ou mem0.',
          ]},
          { t: 'code', c: '« Comment traite-t-on un rejet R03 supérieur à 500 000 FCFA ? »\n« Quelles sont les étapes de validation d\'un appel d\'offres ? »' },
        ],
      },
      {
        id: 'knowledge-risk', kicker: 'Utiliser Companion', title: 'Knowledge Risk',
        blocks: [
          { t: 'p', c: 'Un score global (0–100) et cinq facteurs qui mesurent le risque de **perte de savoir** :' },
          { t: 'table', head: ['Facteur', 'Question posée'], rows: [
            ['Dépendance aux personnes clés', 'Quel savoir n\'existe que dans une seule tête ?'],
            ['Couverture des rôles', 'Quels postes n\'ont pas de savoir validé ?'],
            ['Fraîcheur', 'Quand les connaissances clés ont-elles été confirmées ?'],
            ['Diversité des sources', 'Le savoir repose-t-il sur plusieurs canaux ?'],
            ['Préparation des handovers', 'Les transmissions sont-elles prêtes ?'],
          ]},
          { t: 'p', c: 'Chaque facteur pointe vers les employés, rôles et documents concernés : le score devient un **plan d\'action**.' },
        ],
      },
      {
        id: 'handover', kicker: 'Utiliser Companion', title: 'Handover — transmission de poste',
        blocks: [
          { t: 'h2', c: 'Le flux' },
          { t: 'ol', items: [
            '**Analyser** — comparaison de la mémoire du partant au Role Brain du poste ;',
            '**Détecter les manques** — ce que lui seul sait apparaît explicitement ;',
            '**Questionner** — un entretien ciblé comble les manques ;',
            '**Valider** — chaque réponse devient une connaissance candidate, relue puis validée ;',
            '**Transmettre** — le pack de handover : version humaine + version machine pour les agents.',
          ]},
          { t: 'p', c: 'Désignez un successeur : son **onboarding** peut être généré automatiquement, avec un score de préparation (readiness).' },
          { t: 'note', tone: 'warn', c: 'Lancez le handover **3 à 6 semaines** avant le départ — assez tôt pour l\'entretien, assez tard pour un savoir à jour.' },
        ],
      },
      {
        id: 'onboarding', kicker: 'Utiliser Companion', title: 'Onboarding',
        blocks: [
          { t: 'table', head: ['Phase', 'Contenu'], rows: [
            ['**J1**', 'Contexte, outils, contacts, procédures critiques'],
            ['**J7**', 'Processus du poste, cas particuliers'],
            ['**J30**', 'Exceptions, relations, historique des décisions'],
          ]},
          { t: 'p', c: 'Le plan est construit depuis le Role Brain, le handover du prédécesseur, le Company Brain et les projets en cours. Un score de **readiness** suit la progression.' },
        ],
      },
    ],
  },
  {
    group: 'Agents',
    articles: [
      {
        id: 'comprendre-agents', kicker: 'Agents', title: 'Comprendre les agents',
        blocks: [
          { t: 'table', head: ['Agent', 'Mission'], rows: [
            ['**Knowledge Agent**', 'Détecte les contradictions, propose des corrections sourcées'],
            ['**Handover Copilot**', 'Analyse les manques, prépare entretiens et packs'],
            ['**Onboarding Copilot**', 'Construit les plans J1 / J7 / J30'],
            ['**Company Assistant**', 'Répond avec citations, prépare les brouillons'],
          ]},
          { t: 'p', c: 'Chaque exécution est persistée : étapes, outils appelés, décisions de politique, tokens, coût estimé, score de vérification. Rien n\'est une boîte noire.' },
        ],
      },
      {
        id: 'niveaux-autonomie', kicker: 'Agents', title: "Niveaux d'autonomie",
        blocks: [
          { t: 'table', head: ['Niveau', 'Comportement'], rows: [
            ['**Assistant**', 'Propose, l\'humain exécute'],
            ['**Copilot**', 'Exécute les actions internes ; actions sensibles soumises à approbation'],
            ['**Autonome**', 'Réservé, par agent et par outil, aux actions à risque nul'],
          ]},
          { t: 'note', tone: 'info', c: 'Par défaut, tout agent est en **copilot** : pas d\'email sortant ni d\'action externe sans approbation humaine.' },
        ],
      },
      {
        id: 'approvals', kicker: 'Agents', title: 'Approvals',
        blocks: [
          { t: 'p', c: 'Avant toute action sensible, l\'agent **suspend** son travail et soumet une demande : action prévue, aperçu du contenu, sources utilisées, raison.' },
          { t: 'ul', items: [
            '**Approuver** → le workflow reprend exactement où il s\'était arrêté ;',
            '**Rejeter** → le run se termine proprement, journalisé ;',
            'Les décisions sont attribuées (qui, quand) et conservées dans l\'audit.',
          ]},
        ],
      },
      {
        id: 'automations', kicker: 'Agents', title: 'Automations & triggers',
        blocks: [
          { t: 'table', head: ['Déclencheur', 'Effet'], rows: [
            ['`employee.leaving`', 'Ouvre un handover assisté'],
            ['`employee.created`', 'Prépare un onboarding'],
            ['`memory.contradicted`', 'Le Knowledge Agent examine la contradiction'],
            ['`knowledge_risk.high`', 'Alerte et recommandations'],
            ['`source.ingested`', 'Traitement des nouveaux documents'],
          ]},
          { t: 'p', c: 'Chaque déclencheur peut être activé/coupé individuellement depuis **Automations**.' },
        ],
      },
      {
        id: 'activity-audit', kicker: 'Agents', title: 'Activity / Audit',
        blocks: [
          { t: 'p', c: '**Activity** montre l\'activité des agents. Le **journal d\'audit** enregistre toutes les actions sensibles :' },
          { t: 'ul', items: [
            'connexions, changements de rôle, invitations ;',
            'validations, corrections, promotions de connaissances ;',
            'décisions de politique des agents (autorisé / refusé, et pourquoi) ;',
            'imports de licence, backups, actions MCP.',
          ]},
          { t: 'note', tone: 'ok', c: 'L\'audit est votre preuve de contrôle : qui a fait quoi, quand, avec quelles sources.' },
        ],
      },
    ],
  },
  {
    group: 'Intégrations',
    articles: [
      { id: 'google-workspace', kicker: 'Intégrations', title: 'Google Workspace', blocks: [
        { t: 'ol', items: [
          '**Sources → Connecter → Google Drive** — l\'autorisation OAuth s\'ouvre ;',
          'Choisissez les dossiers à surveiller ;',
          'L\'ingestion continue démarre : nouveaux fichiers et mises à jour deviennent des connaissances sourcées.',
        ]},
        { t: 'p', c: '**Gmail** s\'active de la même façon : les échanges décisionnels rejoignent la mémoire.' },
        { t: 'note', tone: 'info', c: 'Les connexions se gèrent depuis la couche d\'intégration embarquée — aucune donnée ne transite par KamaLoka.' },
      ]},
      { id: 'microsoft-365', kicker: 'Intégrations', title: 'Microsoft 365', blocks: [
        { t: 'p', c: 'SharePoint, Outlook et Teams se connectent via OAuth depuis **Sources → Connecter → Microsoft 365**. Les permissions Microsoft de chaque utilisateur sont respectées côté Companion.' },
      ]},
      { id: 'whatsapp-business', kicker: 'Intégrations', title: 'WhatsApp Business', blocks: [
        { t: 'p', c: 'Companion peut ingérer les conversations Business (export ou API) pour en extraire décisions et procédures — chaque connaissance garde sa provenance (conversation, date, participants).' },
        { t: 'note', tone: 'warn', c: 'La relecture humaine avant validation est indispensable pour ce canal : ton informel, abréviations, demi-mesures.' },
      ]},
      { id: 'odoo', kicker: 'Intégrations', title: 'Odoo', blocks: [
        { t: 'p', c: 'Connectez votre ERP Odoo pour enrichir la mémoire avec vos processus réels : factures, commandes, flux de validation. L\'ingestion s\'appuie sur l\'API Odoo avec un compte de service dédié (permissions minimales).' },
      ]},
      { id: 'slack', kicker: 'Intégrations', title: 'Slack', blocks: [
        { t: 'p', c: 'Les décisions et procédures discutées dans les canaux deviennent des candidats de mémoire. Chaque connaissance cite le canal, la date et le fil de discussion.' },
      ]},
      { id: 'notion', kicker: 'Intégrations', title: 'Notion', blocks: [
        { t: 'p', c: 'Les pages et bases Notion s\'ingèrent avec leur hiérarchie — idéal pour les wikis internes. Connectez depuis **Sources → Connecter → Notion**.' },
      ]},
      { id: 'api-personnalisee', kicker: 'Intégrations', title: 'API personnalisée', blocks: [
        { t: 'ul', items: [
          '**API REST** — poussez des documents et des candidats de mémoire (voir [API](#api)) ;',
          '**Webhooks** — recevez les événements de Companion dans vos outils (voir [Webhooks](#webhooks)).',
        ]},
      ]},
    ],
  },
  {
    group: 'Administration',
    articles: [
      { id: 'utilisateurs', kicker: 'Administration', title: 'Utilisateurs', blocks: [
        { t: 'p', c: 'Paramètres → **Membres** : invitations par email (lien d\'activation à usage unique, expirant), rôles attribués, désactivation, rattachement à une fiche employé.' },
        { t: 'h2', c: 'Sécurité des comptes' },
        { t: 'ul', items: [
          'Mots de passe hachés (bcrypt), longueur minimale ;',
          'Verrouillage temporaire après échecs répétés ;',
          'Réinitialisation par lien signé à durée limitée ;',
          'Sessions révocables individuellement.',
        ]},
      ]},
      { id: 'roles', kicker: 'Administration', title: 'Rôles', blocks: [
        { t: 'table', head: ['Rôle', 'Périmètre'], rows: [
          ['`owner`', 'Tout, y compris licence et paramètres critiques'],
          ['`admin`', 'Membres, sources, agents, audit'],
          ['`manager`', 'Validation des connaissances de son périmètre, handovers'],
          ['`employee`', 'Sa mémoire, Ask, ses handovers'],
          ['`auditor`', 'Lecture de l\'audit uniquement'],
          ['`agent`', 'Comptes d\'exécution pour les agents'],
        ]},
      ]},
      { id: 'permissions', kicker: 'Administration', title: 'Permissions', blocks: [
        { t: 'p', c: 'Les permissions s\'appliquent **jusqu\'au retrieval** : une question posée par un employé ne peut pas faire remonter une connaissance hors de son périmètre, même par détours (citations, agents, MCP).' },
        { t: 'ul', items: [
          'Portée par **département** et par **poste** ;',
          'Les **agents** héritent des permissions de leur initiateur et de leur périmètre ;',
          'Tentative hors périmètre = refus explicite, journalisé (`DENIED`).',
        ]},
      ]},
      { id: 'licences', kicker: 'Administration', title: 'Licences', blocks: [
        { t: 'p', c: 'Votre licence est un fichier signé cryptographiquement (Ed25519) par KamaLoka : **aucune connexion n\'est nécessaire pour la vérifier**.' },
        { t: 'h2', c: 'Installer / renouveler' },
        { t: 'ol', items: [
          'Paramètres → **Facturation → Importer une licence** ;',
          'Collez le contenu du fichier `companion-license.lic` reçu du portail client ;',
          'Le plan correspondant s\'active immédiatement.',
        ]},
        { t: 'table', head: ['État', 'Effet'], rows: [
          ['Active', 'Tout fonctionne'],
          ['Grâce (30 j)', 'Tout fonctionne + rappel de renouvellement'],
          ['Restreint', 'Consultation, export et **backups restent libres** ; créations (utilisateurs, agents, intégrations, actions agentiques) suspendues'],
        ]},
        { t: 'note', tone: 'ok', c: 'Vos données ne sont jamais prises en otage : même sans licence, tout est accessible et exportable.' },
      ]},
      { id: 'facturation', kicker: 'Administration', title: 'Facturation', blocks: [
        { t: 'p', c: 'La page **Facturation** affiche votre plan, l\'usage comparé aux limites (utilisateurs, agents, intégrations, clients MCP, stockage) et l\'estimation de consommation IA.' },
        { t: 'note', tone: 'info', c: 'Mode **BYOK** par défaut : vos propres clés API, facturées directement par vos fournisseurs, sans marge KamaLoka. Managed AI se choisit à la commande.' },
      ]},
      { id: 'sauvegardes', kicker: 'Administration', title: 'Sauvegardes', blocks: [
        { t: 'p', c: 'Paramètres → **Sauvegardes → Créer une sauvegarde** : export complet JSON (mémoires, versions, sources, employés, rôles, audit…) + copie des fichiers, avec manifeste.' },
        { t: 'h2', c: 'Automatiser' },
        { t: 'code', c: '# crontab — tous les jours à 02:00\n0 2 * * * curl -s -X POST -b "session=<cookie-admin>" \\\n  https://companion.votreentreprise.com/api/backup' },
        { t: 'note', tone: 'warn', c: 'Conservez au moins une sauvegarde **hors du serveur** (stockage distant ou bande).' },
      ]},
      { id: 'restaurer', kicker: 'Administration', title: 'Restaurer Companion', blocks: [
        { t: 'ol', items: [
          'Installez Companion sur la machine cible ([installation standard](#installation)) ;',
          'Paramètres → **Sauvegardes → Restaurer** avec l\'archive ;',
          'Redémarrez — les mémoires sont ré-indexées au démarrage ;',
          'Ré-importez votre licence si le serveur a changé (même fichier, aucune contrainte matérielle).',
        ]},
      ]},
      { id: 'mises-a-jour', kicker: 'Administration', title: 'Mises à jour', blocks: [
        { t: 'p', c: 'Companion vérifie périodiquement la dernière version stable et l\'affiche dans les paramètres. **Aucune mise à jour n\'est jamais appliquée automatiquement.**' },
        { t: 'code', c: '1. Sauvegarde complète        →  POST /api/backup\n2. Récupérer le nouveau kit   →  portail client\n3. docker compose pull && docker compose up -d\n4. Vérifier la santé          →  /api/status\n5. En cas de problème         →  restaurer + image précédente' },
        { t: 'note', tone: 'info', c: 'Le portail client affiche la version installée vs la dernière stable, et les notes de version.' },
      ]},
      { id: 'securite', kicker: 'Administration', title: 'Sécurité', blocks: [
        { t: 'ul', items: [
          '**Chiffrement** — secrets et identifiants d\'intégration chiffrés au repos (AES-256-GCM) ;',
          '**Sessions** — cookies httpOnly, expiration, révocation ;',
          '**Rate limiting** — sur l\'API et le serveur MCP ;',
          '**En-têtes de sécurité** — appliqués par défaut ;',
          '**Moindre privilège** — comptes de service dédiés pour les intégrations ;',
          '**Vérification** — `npm run security:check` pour l\'audit de configuration.',
        ]},
        { t: 'note', tone: 'ok', c: 'KamaLoka n\'a aucun accès à votre instance : le support se fait sur invitation et à votre demande.' },
      ]},
    ],
  },
  {
    group: 'Développeurs',
    articles: [
      { id: 'mcp-server', kicker: 'Développeurs', title: 'MCP Server', blocks: [
        { t: 'p', c: 'Companion expose un serveur **MCP (Model Context Protocol)** : vos assistants et agents externes interrogent la mémoire d\'entreprise — avec permissions, scopes et audit.' },
        { t: 'code', c: 'POST https://companion.votreentreprise.com/mcp\nAuthorization: Bearer <token client MCP>' },
        { t: 'table', head: ['Outil', 'Description'], rows: [
          ['`search_memory`', 'Recherche sourcée dans la mémoire autorisée'],
          ['`get_company_context`', 'Contexte général de l\'entreprise'],
          ['`get_role_context` / `get_employee_context`', 'Contexte d\'un poste ou d\'une personne'],
          ['`get_project_context`', 'Contexte d\'un projet'],
          ['`get_knowledge_gaps`', 'Manques de savoir détectés'],
          ['`create_memory`', 'Créer une **candidature** (jamais validée d\'office)'],
          ['`correct_memory`', 'Proposer une correction sourcée'],
          ['`create_handover` / `request_approval`', 'Lancer une transmission, demander une approbation'],
        ]},
        { t: 'p', c: 'Les clients MCP sont créés par un admin (scopes, outils, expiration) et révocables à tout moment. Toute demande hors périmètre reçoit `DENIED` et est journalisée.' },
      ]},
      { id: 'api', kicker: 'Développeurs', title: 'API', blocks: [
        { t: 'p', c: 'Toutes les routes sont sous `/api`, authentifiées par cookie de session ou par token pour les intégrations serveur.' },
        { t: 'table', head: ['Ressource', 'Routes principales'], rows: [
          ['Mémoires', '`GET /api/memories` · `POST /api/memories` · `POST /api/memories/:id/verify`'],
          ['Ask', '`POST /api/ask` — question, filtres, moteur'],
          ['Employés / Rôles', '`GET /api/employees` · `GET /api/roles`'],
          ['Handovers', '`POST /api/handovers` · `POST /api/handovers/:id/answers` · `POST /api/handovers/:id/pack`'],
          ['Agents', '`GET /api/agents` · `POST /api/agents/:id/runs` · `POST /api/runs/:id/resume`'],
          ['Risk / Sauvegarde', '`GET /api/knowledge-risk` · `POST /api/backup`'],
        ]},
      ]},
      { id: 'authentication', kicker: 'Développeurs', title: 'Authentication', blocks: [
        { t: 'code', c: '# 1. Connexion (cookie de session httpOnly)\ncurl -c cookies.txt -X POST https://…/api/auth/login \\\n  -H "Content-Type: application/json" \\\n  -d \'{"email":"vous@entreprise.com","password":"…"}\'\n\n# 2. Appel authentifié\ncurl -b cookies.txt https://…/api/memories\n\n# 3. Client MCP (Authorization Bearer)\ncurl -H "Authorization: Bearer mcp_…" https://…/mcp' },
      ]},
      { id: 'webhooks', kicker: 'Développeurs', title: 'Webhooks', blocks: [
        { t: 'p', c: 'Les événements internes (`employee.leaving`, `memory.contradicted`, `source.ingested`…) peuvent être relayés vers vos outils via la couche d\'intégration. Chaque livraison porte une signature vérifiable et les tentatives sont journalisées.' },
      ]},
      { id: 'exemples', kicker: 'Développeurs', title: 'Exemples', blocks: [
        { t: 'h2', c: 'Poser une question avec filtre de rôle' },
        { t: 'code', c: 'curl -b cookies.txt -X POST https://…/api/ask \\\n  -H "Content-Type: application/json" \\\n  -d \'{"question":"Procédure d\'escalade fournisseur ?","roleId":"<role-uuid>"}\'' },
        { t: 'h2', c: 'Client MCP (Node.js)' },
        { t: 'code', c: 'import { Client } from "@modelcontextprotocol/sdk/client/index.js"\nimport { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"\n\nconst client = new Client({ name: "mon-agent", version: "1.0.0" })\nawait client.connect(new StreamableHTTPClientTransport(\n  new URL("https://companion.entreprise.com/mcp"),\n  { requestInit: { headers: { Authorization: "Bearer mcp_…" } } },\n))\nconst r = await client.callTool({ name: "search_memory", arguments: { query: "procédure R03" } })' },
      ]},
    ],
  },
  {
    group: 'Dépannage',
    articles: [
      { id: 'diagnostic', kicker: 'Dépannage', title: 'Diagnostic', blocks: [
        { t: 'code', c: '# Santé globale (IA, mémoire, compteurs)\ncurl -s https://…/api/status | jq\n\n# État du moteur mémoire\ncurl -s -b cookies.txt https://…/api/system/memory-provider/health | jq\n\n# Stack Docker\ndocker compose -f docker-compose.prod.yml ps\ndocker compose -f docker-compose.prod.yml logs --tail=100 companion' },
      ]},
      { id: 'mem0-degraded', kicker: 'Dépannage', title: 'Mem0 degraded', blocks: [
        { t: 'p', c: '**Symptôme :** l\'état mémoire affiche « dégradé » ou le moteur retombe sur le moteur natif.' },
        { t: 'ul', items: [
          'Vérifiez que le modèle local tourne : `curl http://127.0.0.1:11434/api/tags` ;',
          'Modèles requis présents (`ollama pull qwen2.5:7b nomic-embed-text`) ;',
          'Le mode dégradé n\'interrompt pas le service : Companion bascule sur le moteur natif et continue de répondre.',
        ]},
      ]},
      { id: 'activepieces-offline', kicker: 'Dépannage', title: 'Activepieces offline', blocks: [
        { t: 'p', c: '**Symptôme :** les connexions Drive/Gmail ne se créent plus ou les outils externes disparaissent.' },
        { t: 'ul', items: [
          '`docker compose ps activepieces` — le conteneur doit être « Up » ;',
          'Redémarrage : `docker compose restart activepieces` ;',
          'Companion redécouvre les outils automatiquement au retour du service.',
        ]},
      ]},
      { id: 'postgresql', kicker: 'Dépannage', title: 'PostgreSQL', blocks: [
        { t: 'code', c: '# Le conteneur répond ?\ndocker exec -it companion-db pg_isready -U companion\n\n# Taille et santé\ndocker exec -it companion-db psql -U companion -d companion \\\n  -c "SELECT pg_size_pretty(pg_database_size(\'companion\'));"' },
        { t: 'p', c: 'Les données vivent dans le volume `companion-pgdata` — sauvegardé par le backup JSON et sauvegeable à froid en arrêtant la stack.' },
      ]},
      { id: 'redis', kicker: 'Dépannage', title: 'Redis', blocks: [
        { t: 'p', c: 'Redis sert au rate limiting et aux files. S\'il est indisponible, Companion bascule sur un limiteur en mémoire : le service continue.' },
        { t: 'code', c: 'docker compose -f docker-compose.prod.yml restart redis' },
      ]},
      { id: 'logs', kicker: 'Dépannage', title: 'Logs', blocks: [
        { t: 'code', c: '# Application\ndocker compose -f docker-compose.prod.yml logs -f companion\n\n# Journal d\'audit applicatif\ncurl -s -b cookies.txt https://…/api/audit | jq' },
        { t: 'note', tone: 'info', c: 'Un problème persistant ? Écrivez à [support@kamaloka.ai](mailto:support@kamaloka.ai) avec le diagnostic (`/api/status`) et les 100 dernières lignes de logs.' },
      ]},
    ],
  },
]

const ALL = DOCS.flatMap((g) => g.articles)

function prevNext(id: string): [Article | null, Article | null] {
  const i = ALL.findIndex((a) => a.id === id)
  return [ALL[i - 1] ?? null, ALL[i + 1] ?? null]
}

function Sidebar({ current }: { current: string }) {
  return (
    <nav aria-label="Rubriques de documentation" className="border-r border-separator-border bg-background-primary-default lg:sticky lg:top-[57px] lg:h-[calc(100vh-57px)] lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:px-4 lg:py-6">
      {DOCS.map((g) => (
        <div key={g.group} className="mb-5">
          <p className="mb-1.5 px-2 text-caption-1-semibold uppercase tracking-[0.12em] text-text-tertiary">{g.group}</p>
          <ul className="space-y-0.5">
            {g.articles.map((a) => (
              <li key={a.id}>
                <a href={`#${a.id}`} aria-current={current === a.id ? 'page' : undefined}
                  className={`block rounded-lg px-2.5 py-1.5 no-underline transition-colors ${current === a.id ? 'bg-background-secondary-default text-body-2-semibold text-text-primary' : 'text-body-2-regular text-text-secondary hover:bg-background-secondary-default hover:text-text-primary'}`}>
                  {a.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function DocsPage() {
  const [current, setCurrent] = useState(() => (location.hash || '#qu-est-ce-que-companion').slice(1))
  useEffect(() => {
    const onHash = () => {
      setCurrent(location.hash.slice(1))
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const article = ALL.find((a) => a.id === current) ?? ALL[0]
  const [prev, next] = prevNext(article.id)

  return (
    <div className="min-h-screen bg-background-full font-sans text-text-primary">
      <header className="sticky top-0 z-10 border-b border-separator-border bg-background-primary-default/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-5 px-5 py-2.5">
          <a href="/landing" className="flex items-center gap-3 no-underline">
            <img src={logoGreen} alt="Companion" className="h-7 w-auto" />
            <span className="text-body-2-medium text-text-tertiary">Documentation</span>
          </a>
          <a href="/landing" className="hidden text-body-2-medium text-text-secondary no-underline hover:text-text-primary sm:block">Site produit</a>
          <a href="/portal/login" className="hidden text-body-2-medium text-text-secondary no-underline hover:text-text-primary sm:block">Portail client</a>
          <span className="flex-1" />
          <ButtonLink variant="primary" size="small" leadingIcon={adaptIcon(ArrowRight02Icon, 18)} href="#installation">
            Installer en 10 min
          </ButtonLink>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <Sidebar current={article.id} />
        <main className="min-w-0 flex-1 px-6 py-10 lg:px-12">
          <article className="max-w-3xl">
            <Chip variant="caption" color="blue">{article.kicker}</Chip>
            <h1 className="mt-3 text-title-1-medium tracking-tight text-text-primary">{article.title}</h1>
            <div className={`mt-7 ${GAPS}`}>
              {article.blocks.map((b, i) => <BlockView key={i} b={b} />)}
            </div>
            <div className="mt-14 flex items-center justify-between gap-4 border-t border-separator-border pt-5">
              {prev
                ? <a href={`#${prev.id}`} className="flex items-center gap-1.5 text-body-2-semibold text-accent-600 no-underline"><HugeIcon icon={ArrowLeft01Icon} size="xs" />{prev.title}</a>
                : <span />}
              {next
                ? <a href={`#${next.id}`} className="flex items-center gap-1.5 text-body-2-semibold text-accent-600 no-underline">{next.title}<HugeIcon icon={ArrowRight02Icon} size="xs" /></a>
                : <span />}
            </div>
          </article>
        </main>
      </div>

      <footer className="border-t border-separator-border px-6 py-6 text-center text-caption-1-medium text-text-tertiary">
        Companion — KamaLoka AI Technologies · <a href="/landing" className="text-accent-600 no-underline">Site produit</a> · <a href="/portal/login" className="text-accent-600 no-underline">Portail client</a>
      </footer>
    </div>
  )
}
