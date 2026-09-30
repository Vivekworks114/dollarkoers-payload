#!/usr/bin/env bash
#
# Install dependencies, build Payload, and reload PM2 on the VPS.
#
# One-time setup (on the server):
#   cd /var/www/dollarkoers
#   cp apps/payload/.env.example apps/payload/.env   # fill in production values
#   sudo mkdir -p /var/log/payload && sudo chown "$USER:$USER" /var/log/payload
#   npm install -g pnpm pm2
#   ./scripts/vps-deploy-payload.sh --first-run
#
# Every code update:
#   ./scripts/vps-deploy-payload.sh
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

DO_PULL=1
FRESH_BUILD=0
FIRST_RUN=0

for arg in "$@"; do
  case "$arg" in
    --no-pull) DO_PULL=0 ;;
    --fresh) FRESH_BUILD=1 ;;
    --first-run) FIRST_RUN=1 ;;
    -h|--help)
      echo "Usage: $0 [--first-run] [--fresh] [--no-pull]"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ ! -f apps/payload/.env ]]; then
  echo "Missing apps/payload/.env — copy from .env.example and set production values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source apps/payload/.env
set +a

mkdir -p /var/log/payload

echo "==> Repo: $REPO_ROOT"

if [[ "$DO_PULL" -eq 1 ]]; then
  echo "==> git pull"
  git pull --ff-only
fi

echo "==> pnpm install"
pnpm install --frozen-lockfile 2>/dev/null || pnpm install

if [[ -n "${DATABASE_URI:-}" ]] && command -v psql >/dev/null 2>&1; then
  echo "==> sync Postgres schema (new columns)"
  psql "$DATABASE_URI" -v ON_ERROR_STOP=1 -f apps/payload/scripts/sync-prod-schema.sql
elif [[ -n "${DATABASE_URI:-}" ]]; then
  echo "==> skip schema sync (install postgresql-client for psql, or run sync-prod-schema.sql manually)"
fi

if [[ "$FRESH_BUILD" -eq 1 ]]; then
  echo "==> Removing apps/payload/.next (fresh build)"
  rm -rf apps/payload/.next
fi

echo "==> generate import map"
pnpm --filter @dollarkoers/payload run generate:importmap

echo "==> build Payload (production)"
pnpm --filter @dollarkoers/payload run build

if command -v pm2 >/dev/null 2>&1; then
  if [[ "$FIRST_RUN" -eq 1 ]] || ! pm2 describe payload >/dev/null 2>&1; then
    echo "==> pm2 start"
    pm2 start ecosystem.config.cjs
    pm2 save
    echo "Tip: run 'pm2 startup' once and follow its instructions for boot on reboot."
  else
    echo "==> pm2 reload payload"
    pm2 reload ecosystem.config.cjs --update-env
  fi
  pm2 status
  echo "Logs: pm2 logs payload --lines 100"
else
  echo "pm2 not installed. Start manually: cd apps/payload && NODE_ENV=production pnpm run start:prod"
fi

echo "==> Done."
