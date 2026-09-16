# Companion

**Les personnes passent. Le savoir reste.**

Plateforme self-hosted de mémoire organisationnelle : ingestion de sources → Memory Engine →
recherche sourcée → Role Brain → Handover → Onboarding. Le frontend (27 routes, BoardUI,
Hugeicons) est branché sur un backend réel PostgreSQL/pgvector.

## Lancer (démo complète, mode le plus simple)

Prérequis : Node 20+, **Ollama** en local (`ollama pull qwen2.5:7b` + `ollama pull nomic-embed-text`).

```powershell
cd C:\Users\OSSEY\Pictures\COMPANION\HTML
npm install
npm run dev:server     # API + frontend de production sur http://localhost:5299
# seed automatique au premier démarrage (Kamaloka AI, 42 employés, 17 rôles, ~4 000 mémoires)
```

Connexion : `ange.niamke@kamaloka.ci` / `companion` (rôle Owner).
Autres comptes seedés : `moussa.kone@kamaloka.ci` (Manager), `audit@kamaloka.ci` (Auditor) — mot de passe `companion`.

Mode développement frontend (HMR) — terminal 2 :

```powershell
npm run dev            # Vite sur http://localhost:5199, /api proxifié vers :5299
```

## Le test qui prouve que Companion est réel

```powershell
npm run dev:server     # serveur lancé
npm run test:demo      # CRITICAL DEMO TEST de bout en bout (17 étapes)
```

Le script crée réellement un employé « Moussa » avec le rôle Responsable Commercial, importe
3 documents (`scripts/demo-docs/`), vérifie l'extraction de memories, pose
« Comment préparons-nous un appel d'offres ? » et vérifie la réponse sourcée, déclare le départ,
détecte les lacunes, répond à l'entretien, valide la mémoire produite, génère le Handover Pack
(humain + machine), assigne Yann et génère son onboarding J1/J7/J30.

## Architecture

```
HTML/
├── src/                  # Frontend Vite + React 19 + TS (27 routes, gelé visuellement)
│   └── services/api.ts   # Client API — fallback mock si backend éteint (aucune route ne casse)
├── server/               # Backend Node/TypeScript (Express)
│   ├── db/               # Drizzle + migrations SQL (17 tables, pgvector 768)
│   ├── services/         # ingestion, embeddings, extraction, memory, ask, risk, handover, onboarding
│   ├── providers/        # Ollama (BYOK/local) — fallback déterministe si Ollama absent
│   ├── auth.ts           # JWT cookie httpOnly + RBAC (owner/admin/manager/employee/auditor/agent)
│   ├── seed.ts           # Seed déterministe aligné sur les chiffres de démo
│   └── index.ts          # Express + API + serve static dist/
├── scripts/              # demo-test.mjs (Moussa→Yann), seed-run.ts, screenshot-routes.cjs
├── docker-compose.yml    # PostgreSQL 16 + pgvector (déploiement self-hosted)
└── data/pg/              # PGlite (Postgres embarqué) — base de dev, créée au premier lancement
```

### Base de données

- **Dev/démo** : PGlite (Postgres 16 embarqué, extension pgvector incluse) dans `data/pg` — zéro service à installer.
- **Production/self-hosted** : `docker compose up -d` puis `DATABASE_URL=postgres://companion:companion@localhost:5433/companion`.
  Même schéma Drizzle, mêmes migrations SQL (`server/db/migrations/`). Sur PostgreSQL, le seed cible
  les chiffres complets de démo (12 842 mémoires) ; sur PGlite il est réduit (~4 000) pour tenir dans
  la mémoire WASM — tous les écrans lisent la base, donc les chiffres restent cohérents entre eux.

### Pipeline d'ingestion

`source → extract (pdf/docx/txt/md/csv/paste) → normalize → chunk → embed (pgvector)
→ extraction candidates (LLM JSON structuré, fallback heuristique française)
→ déduplication (similarité ≥ 0,93 = confirmation) → détection de contradictions (≥ 0,82 = lien
« contradicts » + statut `contradicted`) → save + index`. Le document original est toujours
conservé (`documents.raw_text` + fichier sur disque) et chaque mémoire garde sa provenance
(`memory_sources` : document, chunk, extrait, localisation).

### Règles du Memory Engine

- Une extraction LLM/heuristique n'atteint jamais `verified` sans validation humaine.
- Toute correction crée une `memory_versions` (jamais d'écrasement silencieux).
- Employee Memory ≠ Role Brain : la promotion vers le rôle (`POST /memories/:id/promote`)
  n'accepte que les types durables et conserve contributeur + provenance.
- Ask Companion : recherche hybride (sémantique pgvector 55 % + lexical 20 % + importance 13 %
  + confiance 7 % + fraîcheur 5 %) ; abstention explicite si contexte insuffisant.
- Knowledge Risk : score explicable (single-owner 30 %, couverture 25 %, fraîcheur 15 %,
  diversité des sources 10 %, préparation du transfert 20 %) avec facteurs détaillés par écran.

## Vérifications

```powershell
npm run typecheck          # frontend
npm run typecheck:server   # backend
npm run build              # build production (dist/)
npm run test:demo          # flow Moussa → Yann de bout en bout
```

## État et suite

Fait : phases 1-8 + 11-12 du plan backend (DB, auth/RBAC, ingestion, Memory Engine, Ask réel,
Employee/Role Brain, Knowledge Risk explicable, Handover complet, Onboarding, audit).

Prochaines étapes prévues : Agent Orchestrator (Goal → Plan → Skill → Tool → Approval → Execute →
Verify → Feedback), MCP Server + Client, puis premier connecteur réel (Google Drive ou Microsoft 365).
