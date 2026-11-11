#!/usr/bin/env bash
# Deploy hook for the API on the VPS. Run by `vps-app deploy` (vps-kit) after it
# pulls main; it provides APP_HOSTNAME and APP_PORT, plus FRONTEND_ORIGIN set
# with `vps env uemp FRONTEND_ORIGIN=https://<project>.vercel.app`.
#
# Can also be run by hand from the repo root:
#   APP_HOSTNAME=api.example.com APP_PORT=8050 FRONTEND_ORIGIN=https://x.vercel.app deploy/vps-deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

: "${APP_HOSTNAME:?}" "${APP_PORT:?}" "${FRONTEND_ORIGIN:?set with: vps env uemp FRONTEND_ORIGIN=https://...}"
export API_PORT=$APP_PORT API_BIND=127.0.0.1
COMPOSE=(docker compose -f docker-compose.prod.yml)

# First deploy: generate production settings with fresh secrets.
if [[ ! -f backend/.env.prod ]]; then
  umask 077
  cat > backend/.env.prod <<EOF
DJANGO_SECRET_KEY=$(openssl rand -hex 32)
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,$APP_HOSTNAME,${FRONTEND_ORIGIN#https://}
CSRF_TRUSTED_ORIGINS=$FRONTEND_ORIGIN
COOKIE_SECURE=true
POSTGRES_DB=uemp
POSTGRES_USER=uemp
POSTGRES_PASSWORD=$(openssl rand -hex 24)
POSTGRES_HOST=db
POSTGRES_PORT=5432
SEED_DEMO_DATA=true
EOF
  umask 022
fi

"${COMPOSE[@]}" up -d --build --remove-orphans

for _ in $(seq 1 45); do
  if "${COMPOSE[@]}" exec -T backend curl -fs http://localhost:8000/api/health/ >/dev/null 2>&1; then
    echo "API healthy"
    exit 0
  fi
  sleep 2
done
echo "API did not become healthy" >&2
"${COMPOSE[@]}" logs --tail 50 backend >&2
exit 1
