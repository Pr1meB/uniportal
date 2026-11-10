#!/usr/bin/env bash
# Bring the API up to date with origin/main and rebuild it if anything changed.
#
#   deploy/deploy.sh           # deploy only when main has new commits
#   deploy/deploy.sh --force   # rebuild regardless
#
# The VPS has no inbound SSH, so deploys are pull-based: a systemd timer
# (deploy/uemp-update.timer) runs this every few minutes. CI keeps main green.
set -euo pipefail
cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.prod.yml --profile tunnel)

git fetch --quiet origin main
if [[ "${1:-}" != "--force" && "$(git rev-parse HEAD)" == "$(git rev-parse origin/main)" ]]; then
  exit 0
fi

echo "$(date -Is) deploying $(git rev-parse --short origin/main)"
git reset --hard --quiet origin/main
"${COMPOSE[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null

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
