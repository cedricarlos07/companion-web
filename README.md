# Companion

**Votre entreprise n'oublie plus.**

Companion transforme les documents, emails et conversations de votre entreprise en une mémoire exploitable. Vos équipes posent des questions et obtiennent des réponses sourcées. Les savoirs critiques sont protégés avant les départs.

---

## Installation production (VPS Linux)

```bash
# Prérequis : Docker + Docker Compose sur un VPS Linux propre
git clone <repo> && cd companion

# Générer les secrets
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 16)
export AP_ENCRYPTION_KEY=$(openssl rand -hex 16)
export AP_JWT_SECRET=$(openssl rand -hex 32)

# Démarrer
docker compose -f docker-compose.prod.yml up -d
```

Companion démarre sur `http://<IP>:5299` avec PostgreSQL + pgvector, Redis et Activepieces.
Le seed crée automatiquement les données de démonstration (12 842 mémoires, 42 employés, 17 rôles).

Première connexion : `admin@kamaloka.local` / mot de passe défini lors du seed (à changer immédiatement).

## Développement local

```bash
npm install
npm run dev:server     # API + frontend production sur :5299
npm run dev            # Vite HMR sur :5199 (proxy /api → :5299)
```

**Mode dev utilise PGlite** (Postgres embarqué) — aucune configuration nécessaire.

## Tests

```bash
npm run test:demo              # Scénario Moussa → Yann (18/18)
npm run test:agents            # Scénarios agentiques (18/18)
npm run test:agent-security    # Denials policy (8/8)
npm run test:mcp               # MCP Server tools (12/12)
npm run test:memory-providers  # Benchmark fusion vs native
```

## Architecture

| Couche | Technologie | Rôle |
|---|---|---|
| Frontend | React 19 + BoardUI + Hugeicons | 27 routes, français, production-grade |
| Agent Runtime | Mastra 1.67 | 4 agents, 5 workflows, suspend/resume HITL |
| Memory Runtime | Mem0 3.1.8 + natif (fusion) | Recherche hybride, consolidation, provenance |
| Intégrations | Activepieces | 760+ apps connectées via un seul hub |
| MCP Server | @modelcontextprotocol/sdk 1.30 | Claude/Codex/Cursor interrogent le Brain |
| Base de données | PostgreSQL 16 + pgvector + Drizzle ORM | 17 tables, vectoriel 768-dim |
| Sécurité | JWT + RBAC + Policy Engine + Audit | 6 rôles, allowlists, budgets, lockout |

## Config Activepieces (intégrations externes)

```env
ACTIVEPIECES_ENABLED=true
ACTIVEPIECES_URL=http://localhost:5678
ACTIVEPIECES_MCP_TOKEN=<généré dans Activepieces → Settings → MCP>
ACTIVEPIECES_PROJECT_ID=<project id>
```

Companion provisionne automatiquement les flows (Drive, Gmail, etc.) au démarrage.
Le client n'interagit qu'avec le bouton **"Connecter"** dans l'UI Companion — OAuth Google géré par Activepieces.
