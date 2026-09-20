# Guide administrateur — Companion self-hosted

> Pour le DSI / l'admin qui installe, exploite et met à jour l'instance.
> Compléter ce guide fait partie du processus de release
> (`docs/process-release.md`).

---

## 1. Installation

```bash
# Prérequis : VPS Linux + Docker + Docker Compose
git clone <url-du-repo> && cd companion

export POSTGRES_PASSWORD=$(openssl rand -hex 16)
export JWT_SECRET=$(openssl rand -hex 32)          # 32+ caractères
export ENCRYPTION_KEY=$(openssl rand -hex 16)
export AP_ENCRYPTION_KEY=$(openssl rand -hex 16)
export AP_JWT_SECRET=$(openssl rand -hex 32)

docker compose -f docker-compose.prod.yml up -d
```

- Stack : PostgreSQL 16 + pgvector, Redis, Activepieces (optionnel),
  Companion sur `:5299`.
- Premier démarrage : migrations automatiques + seed de démonstration —
  **connectez-vous et supprimez/modifiez les comptes de démo** avant mise en
  service réelle.
- Invitez les premiers utilisateurs : Paramètres → Membres (voir guide
  utilisateur §14).

### Variables utiles

| Variable | Rôle |
|---|---|
| `PORT` | Port d'écoute (défaut 5299) |
| `DATABASE_URL` | PostgreSQL externe (sinon PGlite embarqué, dev uniquement) |
| `LICENSE_SERVER_URL` | URL du Control Center KamaLoka — **requis pour l'offre standard** (lease connecté) |
| `LICENSE_PUBLIC_KEY` | Clé publique de vérification des licences (fournie par KamaLoka) |
| `LICENSE_GRACE_DAYS` | Durée de grâce après lease expiré (défaut 30) |
| `ACTIVEPIECES_ENABLED` + `ACTIVEPIECES_URL` + `ACTIVEPIECES_MCP_TOKEN` | Connecteurs applicatifs |
| `OLLAMA_URL`, `LLM_MODEL`, `EMBED_MODEL` | IA locale (chat + embeddings) |
| `ALLOW_MOCK_DATA` | **Ne jamais définir en production** — un build avec mock activé refuse de démarrer |

---

## 2. Licence — activer, renouveler, modes

1. À la souscription, KamaLoka vous remet :
   - un **fichier `.lic`** signé (Ed25519) ;
   - un **token portail** (`cmp_portal_…`) pour le portail client.
2. Importez la licence : **Facturation → Importer une licence** (owner).
3. Avec `LICENSE_SERVER_URL` configuré, l'instance envoie un **heartbeat**
   (télémétrie technique uniquement : compteurs agrégés, santé — jamais de
   contenu métier) et reçoit un **lease** signé renouvelé automatiquement.

**Modes et leviers** — la révocation KamaLoka n'est jamais un kill :

| Mode | Ce qui marche | Ce qui est bloqué |
|---|---|---|
| Actif | Tout | — |
| Grâce (30 j) | Tout + bannière | — |
| Restreint | Consultation, **export, backups** | Invitations, agents, intégrations, actions agentiques (erreur 402) |

Paiement reçu → KamaLoka prolonge la licence → votre lease se renouvelle au
heartbeat suivant → retour automatique en mode actif. Le nouveau `.lic` est
téléchargeable dans le **portail client** (à réimporter pour refléter la
nouvelle expiration hors connexion).

---

## 3. Mises à jour

### Vérifier
- Interface : l'application signale une mise à jour disponible
  (`/api/system/update-check` interroge le Control Center).
- CLI : `./update.sh --check`

### Appliquer

```bash
./update.sh
```

Le script : **backup automatique** → récupère le tag publié
(`git checkout vX.Y.Z`) → rebuild Docker → redémarre → vérifie la santé.
Migrations SQL versionnées et idempotentes. Si l'instance ne redémarre pas :
vos données sont intactes, revenez au tag précédent
(`git checkout vX.Y.(Z-1) && docker compose ... up -d`).

### Philosovie
L'update est **informatif puis volontaire** — rien n'est appliqué à
l'insu de l'admin. Les versions sont publiées par KamaLoka avec un
changelog (visible aussi sur le portail client, Téléchargements).

---

## 4. Sauvegardes & restauration

- **Créer** : Paramètres → Sauvegardes → « Sauvegarder maintenant »
  (base + fichiers, horodatée, auditée) ou `POST /api/backup`.
- **Lister** : même écran (contenu du manifeste : lignes par table, fichiers).
- **Restaurer** : opération owner uniquement — contactez KamaLoka ou suivez
  la procédure `POST /api/restore` avec le répertoire de backup.
- Conseil : exportez aussi les backups **hors du serveur** (copie chiffrée)
  — la sauvegarde locale protège d'un bug, pas d'une perte du serveur.

---

## 5. Sécurité

- **Vérification d'instance** : Paramètres → Sécurité (réservé owner/admin) —
  contrôle la configuration serveur (driver de base en production, longueurs
  des secrets JWT/ENCRYPTION).
- **Permissions** : appliquées serveur ; les rôles ne peuvent pas être
  élargis par le client (voir guide utilisateur §1).
- **Confidentialité heartbeat** : trois couches — télémétrie de licence
  (obligatoire, technique), amélioration produit (**opt-in, non implémenté**),
  entraînement de modèles (**jamais**).
- **IA locale** : chat et embeddings tournent sur VOTRE serveur Ollama — les
  contenus ne quittent pas l'instance. Modèles épinglés dans Paramètres →
  Fournisseurs IA.
- **MCP** (si activé) : clients à token, scopes par client, expiration,
  révocation — même policy que les agents.

---

## 6. Dépannage

| Symptôme | Vérifier |
|---|---|
| « Backend indisponible » à l'écran | `docker compose logs companion` ; l'API répond-elle sur `/api/status` ? |
| Réponses dégradées / sans LLM | Ollama joignable ? Modèles épinglés présents ? (Paramètres → Fournisseurs IA → Vérifier) |
| Instance passée en grâce/restreint | Facturation à jour côté KamaLoka ? `LICENSE_SERVER_URL` joignable depuis le serveur ? |
| Import de fichier refusé | Formats serveur : `.pdf .docx .txt .md .csv` ; taille max 25 Mo/fichier |
| Invitation non reçue | V1 sans email sortant : récupérez le lien auprès de KamaLoka ou créez le compte depuis l'admin |
| Mot de passe perdu | L'admin régénère via « mot de passe oublié » (token en V1 remis hors bande) |

Logs : `docker compose logs -f companion` (le serveur journalise SQL en
échec, seed, heartbeats, ingestion).

---

## 7. Portail client KamaLoka (`/portal`)

Réservé à la relation commerciale/technique (DSI, achats) — séparé de
l'application, **aucune donnée métier n'y transite** :

- Connexion par **token portail** (fourni par KamaLoka, un par licence) ;
- **Licence** : plan, limites, expiration, retéléchargement du `.lic` ;
- **Instances** : déclarées par heartbeat (version, dernier contact, mode) ;
- **Factures** : historique réel ;
- **Téléchargements** : versions publiées ;
- **Support** : ouvrir un ticket (mailto), diagnostic technique de vos
  instances.
