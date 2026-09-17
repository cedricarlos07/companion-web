#!/usr/bin/env bash
# ============================================================
# COMPANION — Script de déploiement production
# Usage : ./deploy.sh <IP_SERVEUR>  (en tant que root sur le serveur)
# ============================================================
set -euo pipefail

echo "═══════════════════════════════════════"
echo "  COMPANION — Déploiement production"
echo "═══════════════════════════════════════"

# ---- Vérifications préalables ----
if [ "$(id -u)" -ne 0 ]; then echo "ERREUR: exécuter en tant que root"; exit 1; fi
if ! command -v docker &>/dev/null; then echo "ERREUR: Docker non installé"; echo "Installez: curl -fsSL https://get.docker.com | sh"; exit 1; fi

# ---- Variables d'environnement (à remplir) ----
: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD requis (openssl rand -hex 16)}
: ${JWT_SECRET:?JWT_SECRET requis (openssl rand -hex 32)}
: ${ENCRYPTION_KEY:?ENCRYPTION_KEY requis (openssl rand -hex 16)}
: ${AP_ENCRYPTION_KEY:?AP_ENCRYPTION_KEY requis (openssl rand -hex 16)}
: ${AP_JWT_SECRET:?AP_JWT_SECRET requis (openssl rand -hex 32)}
export POSTGRES_PASSWORD JWT_SECRET ENCRYPTION_KEY AP_ENCRYPTION_KEY AP_JWT_SECRET

# ---- Étape 1 : Démarrer la stack ----
echo ""
echo "[1/4] Démarrage PostgreSQL + Redis + Activepieces…"
docker compose -f docker-compose.prod.yml up -d postgres redis activepieces
echo "Attente Postgres healthy (30s)…"
sleep 30
docker compose -f docker-compose.prod.yml ps

# ---- Étape 2 : Build Companion ----
echo ""
echo "[2/4] Build Companion (frontend + backend)…"
docker compose -f docker-compose.prod.yml build companion
docker compose -f docker-compose.prod.yml up -d companion

# ---- Étape 3 : Vérifier ----
echo ""
echo "[3/4] Vérifications…"
sleep 10
for i in 1 2 3 4 5; do
  code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5299/api/status 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "✅ Companion répond (HTTP 200)"
    break
  fi
  echo "  attente… ($i/5)"
  sleep 10
done

echo ""
echo "Postgres :"
docker exec companion-db psql -U companion -d companion -c "SELECT extname FROM pg_extension WHERE extname='vector';" 2>/dev/null || echo "  (extension vector sera créée au premier démarrage de Companion)"

# ---- Étape 4 : Résumé ----
echo ""
echo "[4/4] Déploiement terminé."
echo ""
echo "═══════════════════════════════════════"
echo "  Companion       : http://$(hostname -I | awk '{print $1}'):5299"
echo "  Activepieces    : http://$(hostname -I | awk '{print $1}'):5678"
echo "═══════════════════════════════════════"
echo ""
echo "Première connexion : le seed crée automatiquement :"
echo "  Email    : admin@kamaloka.local"
echo "  Password : companion"
echo ""
echo "⚠️  Changez ce mot de passe immédiatement après la première connexion."
