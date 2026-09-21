# Companion

**Votre entreprise n'oublie plus.**

Companion transforme les documents, emails et conversations de votre entreprise en une mémoire exploitable. Vos équipes posent des questions et obtiennent des réponses sourcées. Les savoirs critiques sont protégés avant les départs.

---

## Documentation

| Document | Pour qui | Où |
|---|---|---|
| **Guide de déploiement** — Hetzner, Contabo, Hostinger, OVH, Dokploy, Coolify, HTTPS, migration | DSI | [docs/deploiement.md](docs/deploiement.md) |
| Guide utilisateur | Les équipes — chaque module, écran et action | [docs/guide-utilisateur.md](docs/guide-utilisateur.md) |
| Matrice d'audit frontend | Dev — état anti-mock par route | [docs/FRONTEND-AUDIT.md](docs/FRONTEND-AUDIT.md) |
| Guide administrateur (installation, licence, updates, backups) | DSI du client | Fourni par KamaLoka avec la licence (dépôt Control Center, non distribué) |
| Process de release, politique paiements | Interne KamaLoka | Dépôt Control Center |

---

## Installation production (VPS Linux) — une commande, images pré-construites

Sur un VPS Linux neuf (Ubuntu/Debian) :

```bash
curl -fsSL https://raw.githubusercontent.com/cedricarlos07/companion-web/main/install.sh | bash
```

Aucun clone, aucun build : le script installe Docker si besoin, génère les
secrets, **tire les images publiées** (GHCR) et démarre la stack.

**Dernière étape (2 minutes, dans le navigateur)** : ouvrez `http://<IP>:5299`
— l'assistant de configuration crée votre organisation, votre compte
administrateur et invite votre équipe. **Instance vierge par défaut.**

Mise à jour ultérieure : `./update.sh` (backup → nouvelle image → santé).

> ⚠ Une seule action manuelle côté KamaLoka après la première publication :
> rendre le package GHCR public (GitHub → Packages → companion-web →
> Package settings → Change visibility → Public) pour que les clients
> puissent tirer l'image sans token.

> Données de démonstration (démos commerciales uniquement) : `AUTO_SEED=1`
> avant le premier démarrage — jamais en production.

Installation manuelle (mode source, pour développer) :

```bash
git clone https://github.com/cedricarlos07/companion-web.git && cd companion-web
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
export JWT_SECRET=$(openssl rand -hex 32)
export ENCRYPTION_KEY=$(openssl rand -hex 16)
export AP_ENCRYPTION_KEY=$(openssl rand -hex 16)
export AP_JWT_SECRET=$(openssl rand -hex 32)
docker compose -f docker-compose.prod.yml up -d
```

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
