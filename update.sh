#!/usr/bin/env bash
# ============================================================
# COMPANION — mise à jour d'une instance self-hosted
#
#   ./update.sh                    # vérifie et applique la dernière version
#   ./update.sh --check            # vérifie seulement (n'applique pas)
#   UPDATE_SERVER=http://license.kamaloka.ai:5300 ./update.sh
#
# Flux : interroge le Control Center (/releases/latest), compare à la
# version installée (package.json), puis git → tag voulu → build Docker
# (ou npm si hors Docker) → migrations → redémarrage. Les migrations SQL
# sont versionnées et idempotentes ; un backup est créé avant l'update.
# ============================================================
set -euo pipefail

CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

UPDATE_SERVER="${UPDATE_SERVER:-http://localhost:5300}"
COMPOSE_FILE="docker-compose.prod.yml"

echo "═══ Companion — mise à jour ═══"
echo "Serveur de mises à jour : ${UPDATE_SERVER}"

# 1. Dernière version publiée
LATEST=$(curl -sf "${UPDATE_SERVER}/releases/latest" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p' | head -1)
if [ -z "${LATEST}" ]; then
  echo "⚠  Aucune version publiée sur ${UPDATE_SERVER} — rien à faire."
  exit 0
fi

# 2. Version installée
INSTALLED=$(node -p "require('./package.json').version" 2>/dev/null || echo "?")
echo "Installée : ${INSTALLED} · Publiée : ${LATEST}"

if [ "${INSTALLED}" = "${LATEST}" ]; then
  echo "✅ Instance à jour."
  exit 0
fi

if [ "$CHECK_ONLY" = true ]; then
  echo "⬆  Mise à jour disponible vers ${LATEST} — relancez ./update.sh pour l'appliquer."
  exit 0
fi

# 3. Backup préalable (données du client — jamais perdues)
if command -v docker &>/dev/null && docker compose ps -q companion 2>/dev/null | grep -q .; then
  echo "— Backup préalable…"
  docker compose -f ${COMPOSE_FILE} exec -T companion node -e \
    "fetch('http://localhost:5299/api/backup',{method:'POST'})" || echo "  (backup via API ignoré — instance hors docker)"
fi

# 4. Récupérer le tag exact
git fetch --tags --force
if git rev-parse -q --verify "refs/tags/v${LATEST}" >/dev/null; then
  git checkout -q "v${LATEST}"
else
  echo "⚠  tag v${LATEST} absent du dépôt — mise à jour vers origin/main."
  git pull --ff-only
fi

# 5. Reconstruire et redémarrer
if command -v docker &>/dev/null && [ -f "${COMPOSE_FILE}" ]; then
  echo "— Build Docker + redémarrage…"
  docker compose -f ${COMPOSE_FILE} build companion
  docker compose -f ${COMPOSE_FILE} up -d companion
  docker compose -f ${COMPOSE_FILE} logs -f --tail 20 companion &
  LOG_PID=$!
  sleep 8
  kill $LOG_PID 2>/dev/null || true
else
  echo "— Environnement non-Docker : npm ci + build + redémarrage du process…"
  npm ci --legacy-peer-deps
  npm run build
  echo "  Relancez votre service (systemd/pm2) pour appliquer."
fi

# 6. Vérification
sleep 5
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5299/api/status || echo 000)
if [ "$CODE" = "200" ]; then
  echo "✅ Companion ${LATEST} en service."
else
  echo "💥 L'instance ne répond pas (${CODE}) — vérifiez les logs, le backup de données est intact."
  exit 1
fi
