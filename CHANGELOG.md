# Changelog — Companion

## v1.0.5 (2026-09-21)

Landing : section self-hosted avec la commande d'installation. Docs : mise
à jour complète (installation en 1 commande, assistant 3 étapes, mises à
jour via ./update.sh, base embarquée par défaut).
## v1.0.4 (2026-09-21)

Le site public (landing, documentation, démo) est servi par l'instance elle-même.

- Racine du domaine = landing page produit + pages /docs et /demo
- L'application reste sur /login, /setup et ses routes métier
- Assets marketing isolés sous /site/ (zéro collision avec l'app)
- Garde de session v1.0.3 intacte : /home exige une session
## v1.0.3 (2026-09-21)

Sécurité d'accès : garde de session sur toute l'application.

- Les visiteurs non authentifiés sont redirigés vers /login (ou /setup sur
  une instance vierge) — plus jamais l'accueil avec des erreurs de backend.
- L'assistant de configuration reste accessible sur instance vierge.
## v1.0.2 (2026-09-21)

Installation simplifiée — images pré-construites + instance vierge.

### Déploiement
- Images Docker publiées sur GHCR à chaque release (plus de build côté client)
- docker-compose.pull.yml : déploiement par tirage d'images (postgres + companion)
- install.sh v2 : une commande, aucun clone ni build ; ./update.sh tire les images
- Instance client VIERGE par défaut : seed de démonstration OPT-IN (AUTO_SEED=1)
- Assistant de premier démarrage : organisation, département/rôle, compte admin,
  invitations réelles ; redirection automatique depuis la page de connexion
- POST /departments et POST /roles (audités) : structure créable sans seed

### CI
- Workflow docker : publication GHCR sur tag, versions cohérentes vérifiées

## v1.0.1 (2026-09-20)

Phase anti-mock terminée — allowlist zéro — loop commercial prouvé.

### Continuité (toutes routes réelles)
- people/:id : statut (déclenche le Handover Agent), génération d'onboarding
- roles/:id : cible de couverture éditable (auditée), vrais pourcentages
- ask : enregistrement en mémoire réelle, abstention déterministe par périmètre
- settings : organisation, membres + invitations, IA épinglée, sauvegardes
- portail client : branché sur l'API du Control Center (token par licence)

### Corrections moteur
- Fuite de périmètre /ask : filtres réappliqués à l'hydratation Mem0/fusion
- MCP : alias SQL manquant sur la recherche scopée (cassé depuis le
  paramétrage) ; seed démo réparé (batch memories invalide)
- Statut 'contradicted' manquant côté frontend (crash Company Brain)

### Licensing & updates
- update.sh : mise à jour instance en une commande (backup → tag → build)
- /system/update-check : version réelle + notes de version du Control Center

### CI
- Gates (SQL, anti-mock, typechecks, build) sur push/PR
- Release automatisée : tag → GitHub Release + publication au Control Center

## v1.0.0-pilot (2026-09-17)

Première version figée pour les pilotes clients.

### Core
- 27 routes frontend (React 19 + BoardUI + Hugeicons, FR)
- PostgreSQL 16 + pgvector (768-dim) — production
- PGlite embarqué — dev/test uniquement
- Drizzle ORM + migrations SQL versionnées

### Memory Engine
- Ingestion : PDF/DOCX/TXT/MD/CSV/texte collé
- Extraction : LLM (Ollama) + fallback heuristique français
- Déduplication par propriétaire + détection de contradictions
- Provenance (document, chunk, extrait, localisation)
- Versioning (jamais d'écrasement silencieux)
- Scopes : employee / role / department / company / restricted
- 8 types : fact / decision / procedure / relationship / preference / lesson / project / handover
- Statuts : candidate / verified / active / contradicted / superseded / deprecated / rejected
- Fusion retrieval : Mem0 + natif → dédup → reranking Companion

### Ask Companion
- Recherche hybride (sémantique + lexical + importance + confiance + fraîcheur)
- Réponse sourcée avec citations numérotées
- Abstention explicite si contexte insuffisant
- Permissions propagées jusqu'au retrieval

### Agents (Mastra 1.67)
- 4 agents : Knowledge (assistant), Handover (copilote), Onboarding (copilote), Company Assistant (copilote)
- 5 workflows avec suspend/resume HITL
- Policy Engine (allowlist, scopes, budgets, kill switch)
- Connection Reconciler (OAuth → auto-activation des flows)
- Evals : grounding, permission, goal completion

### MCP Server
- 10 tools (search_memory, get_*_context, create_*, correct_memory, etc.)
- Token auth Bearer (sha256 hashés)
- Rate limiting (60 req/min)
- Client management (create/rotate/disable/delete)

### Activepieces Integration
- 760+ applications disponibles
- Auto-provisioning des flows au démarrage
- Connection Reconciler (30s polling)
- Webhook ingestion authentifié (Bearer secret)
- send_email réel (après approbation)

### Auth & Security
- JWT httpOnly cookies (12h)
- RBAC : owner / admin / manager / employee / auditor / agent
- Account lockout (5 tentatives → 15 min)
- Password reset (token hashé, expiration 1h)
- Invitations (token, expiration 7j)
- Rate limiting (Redis ou mémoire)
- Audit log structuré (secrets masqués)
- Security headers (CSP, HSTS, X-Frame-Options…)
- Chiffrement AES-256-GCM des credentials

### Backup / Restore
- Export JSON portable (toutes tables, ordre de dépendances)
- pg_dump pour production
- Uploads inclus
- Restore testé sur base vide

### Licensing
- Licences signées Ed25519 (offline, self-hosted)
- Plans : PILOT (25 users) / BUSINESS (100) / ENTERPRISE (custom)
- Entitlements service (can/getLimit)
- Grace period 14 jours
- Trial 14 jours

### Monitoring
- Disk monitoring dans /api/status
- Health checks : DB, Mem0, Mastra, MCP, Activepieces, Redis, Ollama
- Audit structuré avec requestId, organizationId

### Known limitations
- PGlite (dev) limité en mémoire — utiliser PostgreSQL en production
- Rate limiter Redis nécessite ioredis (fallback mémoire)
- Mem0 store "memory" éphémère en dev (auto-reindex)
- LLM local (Ollama) — pas de comptage de tokens précis
- send_email = mock sandbox (Gmail réel via Activepieces après OAuth)
