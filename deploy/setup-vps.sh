#!/usr/bin/env bash
# One-time setup of the API on a fresh Ubuntu 22.04 VPS.
#
#   curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/deploy/setup-vps.sh -o setup-vps.sh
#   sudo bash setup-vps.sh <repo-url> <cloudflare-tunnel-token> <api-hostname> <frontend-origin>
#
# Installs Docker, clones the repo to /opt/uemp, writes backend/.env.prod with
# generated secrets, starts Postgres + API + Cloudflare Tunnel, and installs a
# systemd timer that redeploys whenever main changes.
set -euo pipefail

REPO_URL=${1:?repo url}
TUNNEL_TOKEN=${2:?cloudflare tunnel token}
API_HOST=${3:?api hostname, e.g. api.example.com}
FRONTEND_ORIGIN=${4:?frontend origin, e.g. https://uemp.vercel.app}
APP_DIR=/opt/uemp
FRONTEND_HOST=${FRONTEND_ORIGIN#https://}

if ! command -v docker >/dev/null; then
  apt-get update -q
  apt-get install -yq ca-certificates curl git
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -q
  apt-get install -yq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi
command -v git >/dev/null || apt-get install -yq git

if [[ ! -d $APP_DIR/.git ]]; then
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

secret() { openssl rand -hex "$1"; }
if [[ ! -f backend/.env.prod ]]; then
  cat > backend/.env.prod <<EOF
DJANGO_SECRET_KEY=$(secret 32)
DJANGO_DEBUG=false
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1,backend,$API_HOST,$FRONTEND_HOST
CSRF_TRUSTED_ORIGINS=$FRONTEND_ORIGIN
COOKIE_SECURE=true
POSTGRES_DB=uemp
POSTGRES_USER=uemp
POSTGRES_PASSWORD=$(secret 24)
POSTGRES_HOST=db
POSTGRES_PORT=5432
SEED_DEMO_DATA=true
EOF
  chmod 600 backend/.env.prod
fi

# Compose reads CF_TUNNEL_TOKEN from .env; the API only listens on localhost,
# the tunnel is the only way in from the internet.
cat > .env <<EOF
CF_TUNNEL_TOKEN=$TUNNEL_TOKEN
API_BIND=127.0.0.1
EOF
chmod 600 .env

install -m 644 deploy/uemp-update.service /etc/systemd/system/uemp-update.service
install -m 644 deploy/uemp-update.timer /etc/systemd/system/uemp-update.timer
systemctl daemon-reload
systemctl enable --now uemp-update.timer

./deploy/deploy.sh --force
echo
echo "Done. API: https://$API_HOST/api/health/"
