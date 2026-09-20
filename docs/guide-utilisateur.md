# Guide utilisateur — Companion

> Tout ce que vous pouvez faire dans l'application, module par module.
> Guide maintenu par KamaLoka : toute modification d'écran passe par une
> mise à jour de ce document (vérifiée à chaque release).

Companion transforme les documents, emails et échanges de votre entreprise
en une **mémoire exploitable** : vous posez des questions, vous obtenez des
réponses **sourcées**. Les savoirs critiques sont protégés avant les départs.

Companion est auto-hébergé : vos données restent sur votre serveur.

---

## 1. Se connecter

- Adresse : l'URL fournie par votre DSI (ex. `http://companion.votre-entreprise.local`).
- Identifiants : votre email professionnel + mot de passe (créés sur
  invitation — voir §14 *Membres*).
- **Mot de passe oublié** : lien sur l'écran de connexion → saisissez votre
  email → un token de réinitialisation vous est transmis par votre
  administrateur (pas d'email sortant en V1).
- « Continuer avec SSO » : non disponible en V1.

**Rôles et droits** (appliqués côté serveur, jamais contournables) :

| Rôle | Peut faire |
|---|---|
| Propriétaire (owner) | Tout + facturation, restauration de backup, tokens |
| Admin | Tout sauf restaurer un backup / importer la licence |
| Manager | Créer employés/invitations, valider mémoires, lancer des agents, approuver |
| Employé | Consulter, poser des questions, répondre aux entretiens — ne voit que son périmètre |
| Auditeur | Tout **lire** (conformité), ne peut rien créer |

---

## 2. Accueil (`/home`)

Votre tableau de bord quotidien — **tous les chiffres sont réels** :

- **Connaissances / Rôles / Transferts / Risque de savoir** : compteurs
  provenant de votre base, cliquables vers le module concerné.
- **À traiter** : construit en direct — approbations en attente, connaissances
  contradictoires à arbitrer, personnes critiques, procédures à propriétaire
  unique. Vide = rien à signaler.
- **Activité des agents** : état des 4+ agents, cliquable vers leur fiche.
- **Risque de savoir** : top des personnes à risque avec score.
- **Transfert en cours** : le handover le plus récent avec son % de préparation.
- **Approbations en attente** : décisions humaines demandées par les agents.
- **Connaissances récentes** : dernières mémoires extraites, cliquables.

---

## 3. Demander à Companion (`/ask`) — le cœur

1. Tapez votre question en langage naturel.
2. Companion cherche dans la mémoire **validée** de votre entreprise.
3. Réponse avec :
   - des **citations numérotées** [1], [2]… et le détail des **sources
     utilisées** (document, extrait) dans le panneau de droite ;
   - un **score de confiance**.
4. Actions sous la réponse :
   - **Copier** la réponse ;
   - **Enregistrer comme mémoire** : la réponse devient une mémoire
     *candidate* à valider dans Company Brain (utile pour capitaliser) ;
   - **Continuer** pour poser une autre question.

**Abstention honnête** : si votre périmètre ne contient pas l'information,
Companion le dit et **refuse d'inventer** — c'est voulu. Importez une source
ou posez la question dans un autre périmètre.

**Filtres** : vous pouvez restreindre la question à un employé, un rôle ou un
département (le périmètre s'applique côté serveur — un employé simple ne voit
de toute façon que ce qui lui est accessible).

---

## 4. Company Brain (`/brain`) — la mémoire

Toutes les connaissances extraites et créées.

- **Filtres** : type (fait, décision, procédure, relation, leçon, projet),
  recherche plein texte, périmètre, statut, confiance minimale.
- **Statuts d'une connaissance** :
  | Statut | Sens |
  |---|---|
  | Candidate | Extraite automatiquement, en attente de validation humaine |
  | Vérifiée | Validée par un humain |
  | Active | En service (utilisée dans les réponses) |
  | Contradictoire | Deux sources se contredisent — à arbitrer |
  | Obsolète / Archivée | Retirée des réponses, conservée pour l'historique |
- **Fiche d'une connaissance** (`/brain/:id`) :
  - contenu, périmètre, rôle, importance, contributeur, propriétaire,
    confirmations, validation humaine ;
  - **Preuves** : extraits des documents sources (traçabilité totale) ;
  - **Connaissances liées** ;
  - **Historique** : chaque version, qui/quand/pourquoi ;
  - **Actions** : **Vérifier**, **Déprécier**, **Signaler un conflit** (la
    mémoire passe « contradictoire » et le Knowledge Agent propose une
    résolution — les deux versions restent consultables jusqu'à décision).
- L'édition de contenu passe par une **nouvelle version sourcée** : importez
  la source corrigée, jamais d'écrasement silencieux.

---

## 5. Personnes (`/people`)

Le savoir de chaque collaborateur.

- **Recherche et filtres** : nom, département, niveau de risque, statut.
- **Ajouter un employé** : prénom, nom, email, rôle → créé côté serveur.
- **Fiche d'une personne** (`/people/:id`) :
  - compteurs (connaissances, procédures, uniques, couverture) ;
  - **Risque de savoir explicable** : score + décomposition pondérée (single-
    owner, couverture, fraîcheur…) ;
  - **Handovers** et **Onboardings** liés, cliquables ;
  - onglets : aperçu, connaissances, projets, relations ;
  - actions du header :
    - **Marquer en départ** → statut « leaving » **et déclenchement
      automatique du Handover Agent** (analyse du poste) ;
    - **Marquer comme parti** / **Réactiver** ;
    - **Générer l'intégration** (pour un arrivant) → parcours J1/J7/J30 ;
    - **Préparer le départ** → assistant de handover.

---

## 6. Rôles & Role Brain (`/roles`, `/roles/:id`)

Le savoir appartient aux **rôles**, pas seulement aux personnes.

- Carte par rôle : couverture, connaissances, procédures, contributeurs.
- **Role Brain** (`/roles/:id`) :
  - onglets procédures / décisions / leçons / clients / projets — issus des
    mémoires rattachées au rôle (y compris par les **anciens contributeurs**) ;
  - **timeline des contributeurs** (qui a constr quoi, de quand à quand) ;
  - **cible de couverture** éditable (owner/admin) : le % visé pour considérer
    le rôle couvert — comparé au % réel par type de connaissance.

---

## 7. Sources (`/sources`, `/sources/new`) — alimenter la mémoire

- **Sources** : connecteurs déclarés + imports manuels, avec statut.
- **Importations récentes** : chaque document (titre, type, taille, statut).
- **Ajouter une source** (`/sources/new`) :
  1. Choisissez le mode : **fichiers** (PDF, Word, TXT, MD, CSV — jusqu'à 10),
     **texte collé**, ou **transcript de réunion** ;
  2. Optionnel : nommez la source (« Procédures SAV 2026 ») ;
  3. **Lancer l'analyse** → pipeline serveur réel : téléversement → lecture →
     extraction → création des mémoires → déduplication/contradictions ;
  4. Résultats réels par document : pages analysées, chunks indexés, mémoires
     candidates créées, confirmations, **conflits détectés** (à examiner avant
     publication).
- Les connecteurs applicatifs (Drive, Gmail, CRM…) se gèrent dans
  **Intégrations** (§17).

---

## 8. Risque de savoir (`/knowledge-risk`)

- **Score global** explicable : single-owner 30 % · couverture 25 % ·
  fraîcheur 15 % · diversité 10 % · préparation du transfert 20 %.
- **Top des personnes à risque** : cliquez une barre pour la **décomposition
  complète du score** puis « Voir le profil ».
- **Dépendances critiques** : rôles critiques réels avec lien direct.
- Recommandation intégrée : lancer un entretien de connaissances avec les
  personnes critiques.

---

## 9. Transferts — Handover (`/handovers`)

Le module qui protège le savoir avant un départ.

### Créer
1. **Nouveau transfert** → choisissez l'employé (ou passez par sa fiche →
   « Marquer en départ » qui démarre l'analyse automatiquement) ;
2. Le **Handover Agent** compare Employee Memory vs Role Brain et détecte
   les **lacunes** ;
3. Résultat : nombre de lacunes + connaissances uniques rattachées au poste.

### Entretenir
- Onglet **Entretien** : questions générées sur chaque lacune. L'employé
  répond ; chaque réponse crée une **mémoire candidate** sourcée.
- Validez les candidates (Company Brain) puis **poussez-les vers le Role
  Brain** — le savoir rejoint le rôle, pas seulement la personne.

### Finaliser
- **Générer le pack** : pack **humain** (document de transfert) + pack
  **machine** (pour les agents) — idempotent, régénérable.
- **Affecter le successeur** → génère son **parcours d'onboarding**.

---

## 10. Intégration / Onboarding (`/onboarding`)

- Liste des parcours en cours avec progression (% d'items complétés) et
  score de « préparation ».
- **Parcours d'un arrivant** (`/onboarding/:id`) : sections construites depuis
  le Role Brain + le handover du prédécesseur + projets actifs.
- L'employé **coche** ses items au fil de l'eau (persistance immédiate) ;
  lui seul ou un manager peut modifier sa progression.

---

## 11. Agents (`/agents`) — ce qu'ils font, ce qu'ils peuvent faire

Les agents exécutent des **workflows réels** avec des garde-fous : allowlist
d'outils, budget de tokens, validation humaine pour les actions à risque,
**jamais d'auto-élevation de permissions**.

### Liste
Compteurs réels (runs, tokens consommés), état (Inactif / En cours / En
pause). **Démarrer / Mettre en pause** = kill switch immédiat.

### Créer un agent (owner/admin) — 6 étapes
1. **Identité** : nom, description, objectif ;
2. **Accès mémoire** : périmètres réels de VOTRE organisation (entreprise,
   rôles, départements) — l'agent ne verra jamais le reste ;
3. **Compétences** : uniquement les workflows réellement exécutables
   (chaque compétence = un workflow) ;
4. **Outils** : policy-gated — un outil à risque exige une validation humaine ;
5. **Autonomie** : Assistant (recommande) / Copilote (prépare + demande) /
   Pilote auto (exécute ce qui est pré-autorisé) ;
6. **Budget** : tokens max par run (plafond quotidien global en plus).

### Fiche d'un agent (`/agents/:id`)
- **Aperçu** : objectif, autonomie, modèle, **budget éditable** (owner/admin)
  et consommation réelle ;
- **Activité** : historique des runs (statut, tokens, vérification) ;
- **Compétences / Outils** : allowlists (deny par défaut) ;
- **Mémoire** : périmètres autorisés ;
- **Déclencheurs** : événements qui démarrent cet agent, on/off ;
- **Lancer une tâche** : compétence + objectif + données JSON optionnelles ;
  un run de relance client s'arrête en **attente d'approbation** avant tout
  envoi.

---

## 12. Automatisations (`/automations`)

Les **déclencheurs** réels : événement métier → workflow d'agent.

| Quand | Alors (agent) |
|---|---|
| Employé « En départ » | Préparer le handover |
| Nouvel employé | Générer l'onboarding |
| Contradiction détectée | Résoudre la contradiction |
| Risque de savoir élevé | Extraire des connaissances |
| Source importée | Extraire des connaissances |

Chaque déclencheur a un **quota anti-tempête** (exécutions/heure max).
**Mettre en pause / Activer** est persistant.

---

## 13. Approbations (`/approvals`)

Quand un agent veut agir sur le monde extérieur (ex. envoyer un email), il
**suspend** son travail et demande :

- **Action** : ce qui serait fait (ex. « Envoyer la relance préparée pour
  X ») avec l'aperçu du contenu ;
- **Risque** : niveau évalué ;
- **Sources** : d'où vient l'information.

**Approuver** → le workflow reprend et exécute. **Rejeter** → le run se
termine en échec documenté. Double-clic impossible, décisions auditées.

---

## 14. Activité (`/activity`) & Membres (Paramètres)

- **Journal d'audit** : 100 derniers événements — qui (humain/agent/système),
  quoi, quand. Filtres : agents, connaissances, sécurité, approbations.
- **Membres** (Paramètres → Membres, owner/admin) : comptes réels de
  l'organisation, statut ; **inviter** par email + rôle → la personne reçoit
  un lien d'activation (mot de passe à définir à la première connexion).

---

## 15. Paramètres (`/settings`) — tout est réel

| Section | Ce que vous y faites |
|---|---|
| Général | Identité de l'organisation (persistée, auditée) + votre profil (lecture) |
| Facturation | Renvoie vers le module Facturation |
| Membres | Comptes + invitations |
| Fournisseurs IA | Modèles de chat/embedding **épinglés** (owner/admin) + état de santé de l'instance — dégradation signalée, jamais de bascule silencieuse |
| Mémoire | Moteur réel (lecture) — les comportements (détection de contradictions, dédoublonnage) sont toujours actifs |
| Agents & triggers | Déclencheurs on/off |
| Sécurité | Vérification automatique de l'instance (config serveur, secrets) + rappel des permissions |
| Sauvegardes | **Sauvegarder maintenant** (auditée) + historique |
| Apparence | Thème clair / sombre / système |

---

## 16. Facturation (`/billing`) — votre licence

- **État** : plan, expiration, mode (actif / grâce / restreint), usage vs
  quotas (utilisateurs, agents, intégrations, MCP, tokens).
- **Importer une licence** (owner) : collez/chargez le fichier `.lic` reçu
  du portail KamaLoka.
- **Modes de licence** :
  | Mode | Effet |
  |---|---|
  | Actif | Tout fonctionne |
  | Grâce (30 j) | Tout fonctionne + bannière de rappel |
  | Restreint | Consultation, **export et backups toujours libres** ; nouvelles créations (invitations, agents, intégrations) bloquées — jamais d'otage des données |
- Portail client KamaLoka (`/portal`) : connectez-vous avec le **token
  portail** fourni par KamaLoka → votre licence (retéléchargeable), vos
  instances déclarées, vos factures, les versions disponibles.

---

## 17. Intégrations (`/integrations`)

Catalogue des connecteurs (via Activepieces) avec recherche par catégorie.
Une intégration marquée « Connectée » correspond à une source active.
La connexion d'un nouvel outil se fait dans la console Activepieces de votre
instance (vos identifiants OAuth ne transitent jamais par KamaLoka).

---

## 18. Bonnes pratiques

1. **Validez les candidates** régulièrement (Company Brain) — seules les
   mémoires validées nourrissent les réponses de confiance.
2. **Arbitrez les contradictions** vite — elles bloquent une information
   fiable.
3. **Marquez les départs tôt** : plus l'entretien démarre tôt, plus le pack
   est complet.
4. **Un import par thème nommé** (« Procédures SAV 2026 ») : la provenance
   des réponses sera claire.
5. **Vérifiez vos backups** (Paramètres → Sauvegardes) au moins une fois par
   trimestre.
