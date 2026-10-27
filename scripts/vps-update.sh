#!/usr/bin/env bash
# Reifexa VPS helper — pull new code and/or pull all AWIN products right now.
#
#   bash scripts/vps-update.sh            # pull backend+frontend, rebuild, restart, sync AWIN, verify prices
#   bash scripts/vps-update.sh sync       # only: import AWIN feed now + verify every shop's prices
#   bash scripts/vps-update.sh check      # only: compare prices on reifexa with the AWIN feed (no import)
#   bash scripts/vps-update.sh backend    # pull + restart backend only
#   bash scripts/vps-update.sh frontend   # pull + build + restart frontend only
#
# Extra arguments go to the AWIN sync, e.g.:
#   bash scripts/vps-update.sh sync --vendor reifen.com
#
# Paths can be overridden: REIFEXA_ROOT=/var/www/agency-site/reifencheck
set -euo pipefail

ROOT="${REIFEXA_ROOT:-/var/www/agency-site/reifencheck}"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
MODE="${1:-all}"
shift || true

say() { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }

pull_repo() {  # $1 = dir; prints "changed" if package-lock.json changed
  local dir="$1" before after
  before=$(git -C "$dir" rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
  git -C "$dir" pull --ff-only >&2
  after=$(git -C "$dir" rev-parse HEAD:package-lock.json 2>/dev/null || echo none)
  [ "$before" != "$after" ] && echo changed || true
}

frontend_pm2_name() {
  pm2 jlist 2>/dev/null | node -e '
    let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
      try{const l=JSON.parse(s);const p=l.find(x=>String(x.pm2_env?.pm_cwd||"").startsWith(process.argv[1]));
      console.log(p?p.name:"")}catch{console.log("")}})' "$FRONTEND"
}

update_backend() {
  say "Backend: git pull"
  if [ "$(pull_repo "$BACKEND")" = "changed" ]; then
    say "Backend: dependencies changed → npm ci"
    (cd "$BACKEND" && npm ci --omit=dev)
  fi
  say "Backend: restart API"
  pm2 restart reifexa-api --update-env || warn "pm2 process 'reifexa-api' not found"
}

update_frontend() {
  say "Frontend: git pull"
  if [ "$(pull_repo "$FRONTEND")" = "changed" ]; then
    say "Frontend: dependencies changed → npm ci"
    (cd "$FRONTEND" && npm ci)
  fi
  say "Frontend: build"
  (cd "$FRONTEND" && npm run build)
  local name; name="$(frontend_pm2_name)"
  if [ -n "$name" ]; then
    say "Frontend: restart pm2 '$name'"
    pm2 restart "$name" --update-env
  else
    warn "No pm2 process runs from $FRONTEND — restart the frontend manually."
  fi
}

sync_awin() {
  # Pause the 3-hourly cron so the manual import and the cron never overlap.
  local cron_was_running=0
  if pm2 describe awin-cron >/dev/null 2>&1; then
    cron_was_running=1
    say "Pausing awin-cron during the manual sync"
    pm2 stop awin-cron >/dev/null
  fi
  say "AWIN: import all products now and verify every shop's prices"
  set +e
  (cd "$BACKEND" && node scripts/awin-sync-now.mjs "$@")
  local code=$?
  set -e
  if [ "$cron_was_running" = 1 ]; then
    say "Restarting awin-cron"
    pm2 restart awin-cron --update-env >/dev/null
  fi
  return $code
}

case "$MODE" in
  all)
    update_backend
    update_frontend
    sync_awin "$@"
    ;;
  backend)  update_backend ;;
  frontend) update_frontend ;;
  sync)     sync_awin "$@" ;;
  check)    (cd "$BACKEND" && node scripts/awin-sync-now.mjs --check-only "$@") ;;
  *)
    echo "Usage: bash scripts/vps-update.sh [all|sync|check|backend|frontend] [--vendor NAME] [--force]"
    exit 2
    ;;
esac
