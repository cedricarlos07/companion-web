# Déployer et configurer Companion — guide complet

> **Objectif : votre instance en ligne en 15 minutes**, même sans être
> expert serveur. Copiez-collez les commandes, suivez l'assistant.
>
> Ce guide couvre : l'installation sur n'importe quel VPS, l'assistant de
> première configuration, l'activation de la licence, les sauvegardes et
> les mises à jour.

---

## 1. Ce qu'il vous faut

| Élément | Recommandation |
|---|---|
| Un serveur Linux (VPS) | Ubuntu 22.04 / 24.04 · 2 vCPU / 4 Go minimum · 40 Go disque |
| Accès SSH | Fourni par l'hébergeur (utilisateur `root`) |
| Un domaine (optionnel) | Pour l'accès en HTTPS — l'IP suffit pour tester |
| Un compte KamaLoka | Pour votre licence (fournie après souscription) |

**Où acheter le VPS ?** N'importe quel hébergeur fonctionne :
[Hetzner](https://hetzner.com/cloud) (CX22, ~4 €/mois),
[Contabo](https://contabo.com) (Cloud VPS 10),
[Hostinger](https://hostinger.com) (KVM 2),
[OVHcloud](https://ovhcloud.com) (s1-4). Créez un serveur **Ubuntu 24.04**.

**IA locale (recommandé)** : les réponses et l'extraction tournent avec
[Ollama](https://ollama.com) sur votre propre serveur — aucune donnée
n'en sort. Sans Ollama, Companion fonctionne en mode dégradé (extraction
heuristique) et passe en LLM dès qu'il est installé.

---

## 2. Installation — une commande

```bash
ssh root@IP_DU_SERVEUR
curl -fsSL https://raw.githubusercontent.com/cedricarlos07/companion-web/main/install.sh | bash
```

Le script : installe Docker si absent → génère vos secrets → télécharge la
configuration → démarre l'application → affiche l'URL **et un code
d'installation** (ex. `CMP-1a2b3c4d`) à saisir dans l'assistant web — lui
seul permet de configurer l'instance, personne d'autre ne peut la revendiquer.

**Sans SSH — le kit .zip** : téléchargez
[companion-deploy-kit.zip](https://github.com/cedricarlos07/companion-web/releases/latest/download/companion-deploy-kit.zip)
(dernière release), copiez-le sur le serveur, dézippez, remplissez `.env`
(secrets générés avec `openssl rand -hex`), puis :

```bash
docker compose up -d
```

**C'est tout pour le serveur.** Vos données vivent dans un volume Docker
dédié (`companion-data`) et survivent aux mises à jour et aux redémarrages.

### Sur Dokploy ou Coolify (panneau web au lieu du SSH)

| Étape | Dokploy | Coolify |
|---|---|---|
| 1. Créer la ressource | New → Docker Compose → collez [`docker-compose.pull.yml`](https://raw.githubusercontent.com/cedricarlos07/companion-web/main/docker-compose.pull.yml) | New Resource → **Docker Image** → `ghcr.io/cedricarlos07/companion-web:latest`, port `5299` |
| 2. Secrets | onglet Environment : `JWT_SECRET` et `ENCRYPTION_KEY` (openssl rand -hex 32 / 16) | idem, onglet Environment Variables |
| 3. Données persistantes | volume `companion-data:/app/data` (déjà dans le compose) | Storage → Add → **Persist directory** → `/app/data` |
| 4. Domaine + HTTPS | onglet Domains → votre domaine → port 5299 | onglet Domains → `https://votre-domaine.fr` → Let's Encrypt auto |
| 5. Deploy | bouton Deploy | bouton Deploy |

### HTTPS avec un domaine (VPS classique)

Le plus simple est [Caddy](https://caddyserver.com) — certificat automatique :

```bash
mkdir -p /root/companion/caddy && cd /root/companion
cat > Caddyfile <<'EOF'
companion.votre-domaine.fr {
    reverse_proxy 127.0.0.1:5299
}
EOF
docker run -d --name caddy --restart unless-stopped --network host \
  -v /root/companion/caddy/Caddyfile:/etc/caddy/Caddyfile \
  -v caddy-data:/data caddy:2
```

(Enregistrement DNS type A : `companion.votre-domaine.fr` → IP du serveur.
Sur Dokploy/Coolify, le HTTPS est intégré — cette étape est inutile.)

---

## 3. L'assistant de configuration (2 minutes)

Ouvrez `http://IP:5299` (ou votre domaine HTTPS). La **page d'accueil
présente le produit** ; cliquez « Se connecter ». Une instance vierge vous
envoie directement à l'assistant : il crée tout.

**Étape 1 — Votre organisation**
- Nom de l'entreprise, secteur, pays
- Premier département et premier rôle (ex. « Direction » / « Directeur
  Général ») — modifiables ensuite
- **Votre compte administrateur** : prénom, nom, email, mot de passe (8+)

**Étape 2 — Inviter votre équipe**
- Une ligne par personne : nom, email, rôle (Employé / Manager / Admin /
  Auditeur)
- Chaque invité reçoit un lien d'activation et choisit son mot de passe

**Étape 3 — C'est prêt**
- « Importer mes premiers documents » → alimente la mémoire (§4)
- Vous êtes connecté en tant qu'administrateur

> L'URL de connexion reste `votre-domaine.fr/login` pour les prochaines fois.

---

## 4. Premiers pas dans l'application

1. **Importez des documents** (Sources → Ajouter) : PDF, Word, TXT, MD, CSV —
   ou collez directement du texte. Companion extrait les connaissances et
   les propose en *candidates*.
2. **Validez les candidates** (Company Brain) : seules les mémoires validées
   nourrissent les réponses de confiance.
3. **Posez votre première question** (Demander à Companion) : les réponses
   citent leurs sources.
4. **Marquez les savoirs critiques** : Personnes → fiche → niveaux de risque ;
   un départ se prépare depuis la fiche (« Marquer en départ » lance
   automatiquement l'analyse de transfert).

Le détail de chaque module est dans le
[guide utilisateur](guide-utilisateur.md).

---

## 5. Activer votre licence KamaLoka

1. Après souscription, KamaLoka vous remet :
   - un **fichier `.lic`** signé ;
   - vos **identifiants du portail client** (token) ;
   - deux **variables de licence** pour votre serveur.
2. Importez le fichier : **Facturation → Importer la licence** (compte
   propriétaire).
3. Ajoutez au fichier `.env` du serveur les deux lignes fournies par
   KamaLoka, puis redémarrez :
   ```
   LICENSE_SERVER_URL=https://license.kamaloka.ai
   LICENSE_PUBLIC_KEY=<clé publique fournie>
   ```
4. Suivi, factures et versions : **portail client KamaLoka** (lien `/portal`
   de votre instance ou portail dédié).

**Modes de licence** — jamais d'otage des données :

| Mode | Effet |
|---|---|
| Actif | Tout fonctionne |
| Grâce (30 jours) | Tout fonctionne + rappel visible |
| Restreint | Consultation, export et **backups toujours libres** ; seules les nouvelles créations sont suspendues |

---

## 6. Sauvegardes

- **Interface** : Paramètres → Sauvegardes → « Sauvegarder maintenant »
  (base + fichiers, horodatée, historique visible).
- **Avant chaque mise à jour** : `./update.sh` le fait automatiquement.
- Conseil : copiez aussi les sauvegardes hors du serveur (autre machine,
  stockage chiffré). Restauration : contactez KamaLoka ou `POST /api/restore`
  (owner uniquement).

---

## 7. Mises à jour

Les versions sont publiées par KamaLoka avec un changelog. Votre instance
vous signale les mises à jour (bandeau dans l'application et portail client).

```bash
cd ~/companion            # le dossier créé par install.sh
./update.sh --check       # vérifier seulement
./update.sh               # appliquer : backup → nouvelle version → vérification
```

Sur Dokploy/Coolify : Redeploy la ressource (l'image `latest` est re-tirée).
Aucune donnée n'est touchée — le volume `companion-data` est préservé.

---

## 8. Installer l'IA locale (Ollama)

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:7b && ollama pull nomic-embed-text
```

Redémarrez le conteneur Companion (`docker restart companion-app`) puis
vérifiez : Paramètres → Fournisseurs IA → « Vérifier l'instance ».
Les modèles sont **épinglés** : si un modèle manque, Companion le signale
plutôt que de basculer en silence.

---

## 9. Déplacer Companion vers un autre serveur

1. **Nouveau serveur** : installez Companion (§2) — sans passer l'assistant
   (fermez la page).
2. **Copiez les données depuis l'ancien serveur** :
   ```bash
   # ancien serveur
   docker run --rm -v companion_companion-data:/data -v $(pwd):/backup alpine \
     tar czf /backup/companion-data.tar.gz -C /data .
   scp companion-data.tar.gz root@NOUVEAU_SERVEUR:/root/companion/
   # nouveau serveur
   cd ~/companion && docker compose down
   docker run --rm -v companion_companion-data:/data -v /root/companion:/backup alpine \
     sh -c "cd /data && tar xzf /backup/companion-data.tar.gz"
   docker compose up -d
   ```
3. L'instance retrouve **toutes** ses données ; l'assistant n'apparaît pas
   (l'organisation existe).

---

## 10. Dépannage

| Problème | Vérification |
|---|---|
| La page ne s'ouvre pas | `docker ps` — companion « Up » ? · ports du pare-feu (22, 80, 443, 5299) |
| « Backend indisponible » | `docker logs companion-app --tail 50` |
| Réponses en mode dégradé | Ollama installé ? `ollama list` · Paramètres → Fournisseurs IA → Vérifier |
| Import de fichier refusé | Formats : `.pdf .docx .txt .md .csv` · 25 Mo max par fichier |
| Mot de passe admin perdu | Écran de connexion → « Mot de passe oublié » |
| Certificat HTTPS en erreur | DNS à jour ? Ports 80 **et** 443 ouverts (Caddy/Let's Encrypt en ont besoin) |

Logs complets : `docker logs companion-app --tail 100`

---

## 11. Questions fréquentes

**Mes données quittent-elles mon serveur ?**
Non. Le stockage, la base et l'IA locale sont chez vous. Le seul contact
extérieur est le **heartbeat de licence** (compteurs techniques agrégés —
jamais de documents, mémoires ou conversations).

**Puis-je tester sans licence ?**
Oui — l'instance fonctionne en période d'essai. La licence active ensuite
toutes les fonctionnalités de façon continue.

**Que se passe-t-il si j'arrête de payer ?**
Rien de brutal : l'instance passe en « grâce » (30 jours, tout fonctionne),
puis en mode restreint (consultation, export et backups restent libres ; les
créations sont suspendues). Vos données restent les vôtres, exportables à tout
moment.

**Combien d'utilisateurs ?**
Le plan pilot couvre 5 utilisateurs ; business 50. La base embarquée convient
jusqu'à plusieurs dizaines de milliers de documents — au-delà, KamaLoka vous
bascule sur la variante PostgreSQL (même application, même interface).
