#!/usr/bin/env bash
# =============================================================================
#  COMPANION — Installation production (Ubuntu 24.04+, Docker)
#  KamaLoka AI Technologies — licence requise
#
#  Usage :
#    sudo ./install.sh                       # interactif (demande la licence)
#    sudo COMPANION_LICENSE_FILE=../companion-license.lic ./install.sh
#    sudo COMPANION_LICENSE="XXXX…" ./install.sh
# =============================================================================
set -euo pipefail

DOMAIN="${COMPANION_DOMAIN:-}"
LICENSE_FILE="${COMPANION_LICENSE_FILE:-}"
LICENSE="${COMPANION_LICENSE:-}"
DIR="$(cd "$(dirname "$0")" && pwd)"

say()  { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------- pré-requis
say "Vérification des pré-requis"
command -v docker >/dev/null || die "Docker requis — curl -fsSL https://get.docker.com | sh"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 requis"
[ "$(id -u)" -eq 0 ] || die "À exécuter avec sudo"
FREE_GB=$(df --output=avail -BG / | tail -1 | tr -dc '0-9')
[ "${FREE_GB:-0}" -ge 20 ] || die "20 Go d'espace disque minimum requis (trouvé : ${FREE_GB} Go)"
ok "Docker + Compose OK — ${FREE_GB} Go libres"

# ----------------------------------------------------------------- domaine
if [ -z "$DOMAIN" ]; then
  read -rp "Nom de domaine (ex. companion.votreentreprise.com) : " DOMAIN
fi
[ -n "$DOMAIN" ] || die "Domaine requis"

# ------------------------------------------------------------------ licence
say "Licence Companion"
if [ -z "$LICENSE" ] && [ -n "$LICENSE_FILE" ] && [ -f "$LICENSE_FILE" ]; then
  LICENSE="$(cat "$LICENSE_FILE")"
fi
if [ -z "$LICENSE" ] && [ -f "companion-license.lic" ]; then
  LICENSE="$(cat companion-license.lic)"
fi
if [ -z "$LICENSE" ]; then
  echo "Collez le contenu du fichier companion-license.lic (reçu de KamaLoka),"
  echo "puis termine par une ligne vide :"
  LICENSE="$(while IFS= read -r line; do [ -n "$line" ] || break; echo "$line"; done)"
fi
[ -n "$LICENSE" ] || die "Licence requise — contactez votre interlocuteur KamaLoka"
echo "$LICENSE" > companion-license.lic && chmod 600 companion-license.lic
ok "Licence enregistrée (companion-license.lic)"

# -------------------------------------------------------------- environment
say "Génération de la configuration (.env)"
if [ ! -f .env ]; then
  cp .env.example .env
  # Secrets forts générés localement — jamais de valeur par défaut en prod.
  sed -i "s|change_me_generate_a_64_char_hex_secret|$(openssl rand -hex 32)|g" .env
  sed -i "s|change_me_generate_a_32_byte_hex_key|$(openssl rand -hex 16)|g" .env
  sed -i "s|companion.votreentreprise.com|$DOMAIN|g" .env
  ok ".env créé avec des secrets forts"
else
  ok ".env existant conservé"
fi

# ------------------------------------------------------------------- démarrage
say "Démarrage de la stack (PostgreSQL, Redis, Activepieces, Companion)"
docker compose -f docker-compose.prod.yml up -d --wait || die "Échec du démarrage — consultez docker compose logs"

say "Sauvegarde de la licence dans le volume de données"
docker compose -f docker-compose.prod.yml exec -T companion sh -c 'mkdir -p /data/licenses' \
  && docker cp companion-license.lic companion:/data/licenses/ 2>/dev/null \
  || ok "Licence importable aussi via l'interface (Paramètres → Facturation)"

ok "Installation terminée"
cat <<EOF

  Companion est en cours de démarrage sur :  https://${DOMAIN}

  Prochaines étapes :
    1. Importer la licence      → https://${DOMAIN}/setup ou /billing
    2. Créer l'organisation     → assistant de premier démarrage
    3. Connecter vos sources    → Google Drive, Microsoft 365, fichiers…

  Sauvegardes : docker compose -f docker-compose.prod.yml exec companion backup
  Support     : support@kamaloka.ai

EOF
