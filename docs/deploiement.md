# Déployer Companion — tous les hébergeurs

> Choisissez votre situation :
> - **J'ai un VPS Ubuntu** (Hetzner, Contabo, Hostinger, OVH…) → §2
> - **J'utilise Dokploy** → §3
> - **J'utilise Coolify** → §4
> - **Je veux déplacer une instance existante** → §6
>
> Temps total : 10–15 minutes. Aucune compétence requise au-delà de
> copier-coller des commandes. L'instance démarre **vierge** : l'assistant
> web crée votre organisation et votre compte administrateur.

---

## 1. Ce dont vous avez besoin

| Quoi | Recommandation |
|---|---|
| Un serveur Linux (VPS) | Ubuntu 22.04 ou 24.04 · **2 vCPU / 4 Go RAM minimum** (4 vCPU / 8 Go recommandé) · 40 Go disque |
| Accès SSH | Fourni par l'hébergeur (utilisateur `root`) |
| Un nom de domaine (optionnel) | Pour l'accès en HTTPS — sinon l'IP fonctionne |

Companion embarque PostgreSQL + pgvector et Redis. L'IA (chat + embeddings)
tourne localement via **Ollama** — installez-le sur le même serveur après
l'installation (`curl -fsSL https://ollama.com/install.sh | sh && ollama pull
qwen2.5:7b && ollama pull nomic-embed-text`), sinon l'application fonctionne
en mode extraction heuristique (dégradé mais utilisable).

---

## 2. VPS classique — Hetzner, Contabo, Hostinger, OVH…

La même procédure marche partout : un VPS Ubuntu + une commande.

### 2.1 Créer le serveur (console de votre hébergeur)

| Hébergeur | Choix dans la console |
|---|---|
| **Hetzner** | Cloud → New server → Ubuntu 24.04 → CX22 (ou plus) |
| **Contabo** | VPS → Ubuntu 24.04 → Cloud VPS 10 (4 vCPU / 8 Go conseillé) |
| **Hostinger** | VPS → KVM 2 minimum → Template **Ubuntu 24.04** (ou template « Docker » encore plus simple) |
| **OVHcloud** | Public Cloud → Instances → Ubuntu 24.04 → modèle s1-4 ou plus |

### 2.2 Installer (une commande)

```bash
ssh root@IP_DU_SERVEUR
curl -fsSL https://raw.githubusercontent.com/cedricarlos07/companion-web/main/install.sh | bash
```

Le script installe Docker si absent, génère les secrets, tire les images et
démarre la stack. À la fin il affiche l'URL de votre instance.

### 2.3 Configurer (navigateur)

Ouvrez `http://IP_DU_SERVEUR:5299` → l'assistant crée votre organisation,
votre compte administrateur et invite votre équipe. C'est fini.

### 2.4 Pare-feu

Ouvrez dans la console de l'hébergeur (ou `ufw`) : **22** (SSH), **80**
(HTTP/HTTPS), **443** (HTTPS), **5299** (Companion — refermez-le si vous
utilisez le HTTPS du §5).

---

## 3. Dokploy

[Dokploy](https://dokploy.com) est un panneau d'administration auto-hébergé
avec reverse proxy et HTTPS intégrés.

1. **Installez Dokploy** sur votre VPS (Ubuntu) :
   ```bash
   curl -sSL https://dokploy.com/install.sh | sh
   ```
2. Connectez-vous au panneau Dokploy (`http://IP:3000`).
3. **Projet → Create project** (ex. « Companion »).
4. **Create service → Docker Compose → Database & Services** :
   collez le contenu de
   [`docker-compose.pull.yml`](https://raw.githubusercontent.com/cedricarlos07/companion-web/main/docker-compose.pull.yml)
   puis dans l'onglet **Environment** ajoutez :
   ```
   POSTGRES_PASSWORD=<généré : openssl rand -hex 16>
   JWT_SECRET=<généré : openssl rand -hex 32>
   ENCRYPTION_KEY=<généré : openssl rand -hex 16>
   ```
5. **Deploy**. Dokploy tire les images et démarre.
6. **Domaine** : onglet Domains du service `companion` → votre domaine →
   port `5299` → activez HTTPS (Let's Encrypt géré par Dokploy).

---

## 4. Coolify

[Coolify](https://coolify.io) fonctionne comme Dokploy (auto-hébergé,
HTTPS automatique).

1. Installez Coolify sur votre VPS :
   ```bash
   curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sh
   ```
2. **New Project → New Resource → Docker Compose Empty**.
3. Collez le contenu de
   [`docker-compose.pull.yml`](https://raw.githubusercontent.com/cedricarlos07/companion-web/main/docker-compose.pull.yml),
   et les variables d'environnement (même bloc que §3, étape 4).
4. **Deploy** → puis dans le service `companion` → **Domains** →
   `https://companion.votre-domaine.fr` → cochez HTTPS (Let's Encrypt
   automatique) → port `5299`.

---

## 5. HTTPS avec un domaine (recommandé en production)

Le plus simple : **Caddy** (certificats automatiques). Sur le VPS, à côté de
Companion :

```bash
mkdir -p /root/companion/caddy && cd /root/companion
cat > Caddyfile <<'EOF'
companion.votre-domaine.fr {
    reverse_proxy 127.0.0.1:5299
}
EOF
docker run -d --name caddy --restart unless-stopped \
  --network host \
  -v /root/companion/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy-data:/data \
  caddy:2
```

Remplacez `companion.votre-domaine.fr` par votre domaine (enregistrement DNS
de type A vers l'IP du serveur). Caddy obtient et renouvelle le certificat
tout seul. Fermez ensuite le port 5299 — tout passe en HTTPS sur 443.

> Sur Dokploy et Coolify, cette étape est inutile : le HTTPS est intégré
> (§3 étape 6, §4 étape 4).

---

## 6. Déplacer une instance / importer un VPS existant

Vos données vivent dans deux **volumes Docker** (`companion-pgdata`,
`companion-uploads`) plus le fichier `.env`. Pour changer de serveur :

**Sur l'ancien serveur** :
```bash
cd ~/companion
docker compose -f docker-compose.yml down        # ou docker-compose.prod.yml
tar czf companion-data.tar.gz -C /var/lib/docker/volumes \
    companion_companion-pgdata companion_companion-uploads .env
# copiez companion-data.tar.gz vers le nouveau serveur (scp)
```

**Sur le nouveau serveur** (Docker installé) :
```bash
mkdir -p /root/companion && cd /root/companion
# récupérez companion-data.tar.gz ici
tar xzf companion-data.tar.gz -C /var/lib/docker/volumes/
curl -fsSL https://raw.githubusercontent.com/cedricarlos07/companion-web/main/install.sh | bash
# l'instance redémarre avec TOUTES vos données ; l'assistant n'apparaît pas
# (l'organisation existe déjà).
```

> La licence suit l'instance : au premier heartbeat depuis le nouveau
> serveur, elle est reconnue. Si l'instance obtient un nouvel identifiant
> (réinstallation complète plutôt que copie), demandez une **réinitialisation
> d'activation** sur le portail client.

---

## 7. Après l'installation — activer votre licence

1. KamaLoka vous a remis un **fichier `.lic`** et un **token portail**.
2. Dans Companion : **Facturation → Importer la licence** (compte owner).
3. Ajoutez au `.env` du serveur les deux lignes fournies par KamaLoka puis
   `docker compose up -d` :
   ```
   LICENSE_SERVER_URL=https://license.kamaloka.ai
   LICENSE_PUBLIC_KEY=<clé publique fournie>
   ```
   L'instance envoie alors son heartbeat et reste en mode actif en continu.
4. Suivi, factures et versions : **Portail client KamaLoka** (`/portal`,
   connexion par token).

> Sans licence, l'instance fonctionne en période d'essai — le temps de tester.

---

## 8. Dépannage rapide

| Problème | Vérification |
|---|---|
| La page ne s'ouvre pas | `docker ps` (companion et postgres « Up » ?) · pare-feu du port 5299 |
| « Backend indisponible » | `docker logs companion-app --tail 50` — postgres prêt ? `DATABASE_URL` correcte ? |
| Impossible de tirer l'image | Le package GHCR est public — vérifiez `docker pull ghcr.io/cedricarlos07/companion-web:latest` |
| Réponses en mode dégradé | Ollama installé et modèles présents (`ollama list`) · `OLLAMA_URL` joignable depuis le conteneur |
| HTTPS en erreur | Enregistrement DNS à jour ? Ports 80 **et** 443 ouverts (Caddy en a besoin pour le certificat) |
