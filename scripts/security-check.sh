#!/usr/bin/env bash
set -euo pipefail
ERRORS=0
check() {
  local label="$1" result="$2"
  if [ "$result" = "OK" ]; then echo "✅ $label"; else echo "❌ $label — $result"; ERRORS=$((ERRORS+1)); fi
}
if [ -z "${JWT_SECRET:-}" ]; then check "JWT_SECRET défini" "MISSING"; elif [ ${#JWT_SECRET} -lt 32 ]; then check "JWT_SECRET ≥32" "TROP COURT"; else check "JWT_SECRET" "OK"; fi
if [ -z "${ENCRYPTION_KEY:-}" ]; then check "ENCRYPTION_KEY" "MISSING"; else check "ENCRYPTION_KEY" "OK"; fi
check "NODE_ENV" "${NODE_ENV:-UNSET}"
if grep -q "sha256" server/mcp/auth.ts 2>/dev/null; then check "Tokens MCP hashés" "OK"; else check "Tokens MCP hashés" "FAIL"; fi
if grep -q "rate-limiter" server/mcp/http.ts 2>/dev/null; then check "Rate limiting" "OK"; else check "Rate limiting" "FAIL"; fi
if grep -q "securityHeaders" server/index.ts 2>/dev/null; then check "Security headers" "OK"; else check "Security headers" "FAIL"; fi
if grep -q "audit" server/audit.ts 2>/dev/null; then check "Audit" "OK"; else check "Audit" "FAIL"; fi
echo "---"
if [ $ERRORS -gt 0 ]; then echo "💥 $ERRORS erreur(s)"; exit 1; else echo "🔒 SECURITY CHECK PASS"; fi
