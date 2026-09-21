#!/usr/bin/env bash
# ============================================================
# COMPANION — installation en une commande
#
#   curl -fsSL https://raw.githubusercontent.com/cedricarlos07/companion-web/main/install.sh | bash
#
# Installe Docker si absent, génère les secrets, démarre la stack,
# puis : ouvrez http://<ip>:5299 — l'assistant web crée votre
# organisation et votre compte administrateur (instance vierge).
# ============================================================
set -euo pipefail

INSTALL_DIR="${COMPANION_DIR:-$HOME/companion}"

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

# 2. Sources (tag publié, sinon main)
VERSION="${COMPANION_VERSION:-}"
if [ -n "$VERSION" ]; then
  git clone --depth 1 --branch "v$VERSION" https://github.com/cedricarlos07/companion-web.git "$INSTALL_DIR" 2>/dev/null \
    || { echo "💥 tag v$VERSION introuvable"; exit 1; }
else
  git clone --depth 1 https://github.com/cedricarlos07/companion-web.git "$INSTALL_DIR"
fi
cd "$INSTALL_DIR"

# 3. Secrets (idempotent : un .env existant est conservé)
if [ ! -f .env ]; then
  cat > .env <<ENV
POSTGRES_PASSWORD=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)
JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
ENCRYPTION_KEY=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)
AP_ENCRYPTION_KEY=$(openssl rand -hex 16 2>/dev/null || head -c 16 /dev/urandom | xxd -p)
AP_JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p)
ENV
  chmod 600 .env
  echo "— Secrets générés dans $INSTALL_DIR/.env"
fi

# 4. Démarrage
echo "— Démarrage de la stack (PostgreSQL, Redis, Companion)…"
docker compose -f docker-compose.prod.yml up -d

# 5. Attente + URL
IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "localhost")
for i in $(seq 1 30); do
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
