#!/bin/sh
set -e

python manage.py migrate --noinput

if [ "${SEED_DEMO_DATA:-false}" = "true" ]; then
  python manage.py seed_demo --if-empty
fi

exec "$@"
