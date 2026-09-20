# Companion

**Votre entreprise n'oublie plus.**

Companion transforme les documents, emails et conversations de votre entreprise en une mémoire exploitable. Vos équipes posent des questions et obtiennent des réponses sourcées. Les savoirs critiques sont protégés avant les départs.

---

## Documentation

| Document | Pour qui |
|---|---|
| [Guide utilisateur](docs/guide-utilisateur.md) | Les équipes — chaque module, chaque écran, chaque action |
| [Guide administrateur](docs/guide-administrateur.md) | DSI — installation, licence, updates, backups, sécurité, dépannage |
| [Process de release](docs/process-release.md) | Équipe KamaLoka — publier une version (gate doc automatique) |
| [Matrice d'audit frontend](docs/FRONTEND-AUDIT.md) | Dev — état anti-mock par route |
| [Paiements & licences](docs/PAYMENTS.md) | Dev/business — Stripe, Jèko, cycles |

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

---

## Publier une mise à jour (KamaLoka) / Se mettre à jour (clients)

### Côté KamaLoka — publier

```bash
# 1. Bump version + entrée CHANGELOG (## vX.Y.Z obligatoire)
npm version patch        # 1.0.1 → 1.0.2
# 2. Rédiger l'entrée ## vX.Y.Z dans CHANGELOG.md
git add -A && git commit -m "release: vX.Y.Z …"
git tag vX.Y.Z && git push origin main --follow-tags   # tag annoté ou push explicite du tag
```

Le workflow `release.yml` vérifie la cohérence tag ↔ package.json ↔ CHANGELOG,
passe les gates + build, crée la **GitHub Release** (notes du changelog) puis
enregistre la version au Control Center (variables de repo `CC_RELEASE_URL` +
secret `CC_RELEASE_TOKEN` — étape sautée proprement si absentes).

### Côté client self-hosted — se mettre à jour

```bash
./update.sh --check      # une nouvelle version est-elle disponible ?
./update.sh              # backup → git checkout vX.Y.Z → build docker → santé
# (l'app affiche aussi « mise à jour disponible » : /api/system/update-check,
#  et le portail client liste les versions sur /portal/downloads)
```

Philosophie : **informatif d'abord, jamais d'update appliqué en cachette** —
l'instance annonce la disponibilité (app + portail), l'admin du client
applique avec `./update.sh` (backup automatique des données avant tout).
Migrations SQL versionnées et idempotentes.
