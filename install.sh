#!/usr/bin/env bash
# ============================================================
# COMPANION — installation en une commande (images pré-construites)
#
#   curl -fsSL https://raw.githubusercontent.com/cedricarlos07/companion-web/main/install.sh | bash
#
# Installe Docker si absent, génère les secrets, tire les images
# publiées (GHCR) et démarre la stack. Aucun clone, aucun build.
# Ensuite : ouvrez http://<ip>:5299 — l'assistant web crée votre
# organisation et votre compte administrateur (instance vierge).
# ============================================================
set -euo pipefail

INSTALL_DIR="${COMPANION_DIR:-$HOME/companion}"
RAW="https://raw.githubusercontent.com/cedricarlos07/companion-web/main"
VERSION="${COMPANION_VERSION:-latest}"

echo "═══════════════════════════════════════"
echo "  COMPANION — installation"
echo "═══════════════════════════════════════"

# 1. Docker
if ! command -v docker &>/dev/null; then
  echo "— Docker absent : installation…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker 2>/dev/null || true
fi
if ! docker compose version &>/dev/null; then
  echo "💥 Docker Compose introuvable — installez le plugin docker-compose."; exit 1
fi

# 2. Fichiers de déploiement (2 fichiers, rien d'autre)
mkdir -p "$INSTALL_DIR" && cd "$INSTALL_DIR"
curl -fsSL "$RAW/docker-compose.pull.yml" -o docker-compose.yml
curl -fsSL "$RAW/update.sh" -o update.sh && chmod +x update.sh

# 3. Secrets (idempotent : un .env existant est conservé)
if [ ! -f .env ]; then
  rand() { openssl rand -hex "$1" 2>/dev/null || head -c "$1" /dev/urandom | xxd -p; }
  cat > .env <<ENV
COMPANION_VERSION=$VERSION
POSTGRES_PASSWORD=$(rand 16)
JWT_SECRET=$(rand 32)
ENCRYPTION_KEY=$(rand 16)
ENV
  chmod 600 .env
  echo "— Secrets générés dans $INSTALL_DIR/.env"
fi

# 4. Démarrage (pull des images)
echo "— Tirage des images et démarrage…"
docker compose up -d

# 5. Attente + URL
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5299/api/setup/status 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 2
done

echo ""
echo "✅ Companion est installé."
echo ""
echo "   Dernière étape (2 minutes) : ouvrez"
echo ""
echo "      http://${IP}:5299"
echo ""
echo "   L'assistant web crée votre organisation et votre compte"
echo "   administrateur. Instance vierge — aucune donnée de démo."
echo "   Mises à jour : ./update.sh"
