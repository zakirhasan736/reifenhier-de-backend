#!/usr/bin/env bash
# Step 2 – copy all data from MongoDB Atlas to the MongoDB on this VPS.
#
#   bash scripts/mongo-selfhost/migrate.sh trial     # test copy – the site keeps using Atlas
#   bash scripts/mongo-selfhost/migrate.sh final     # real move: short stop, copy, switch .env, restart
#   bash scripts/mongo-selfhost/migrate.sh rollback  # go back to Atlas (restores the old .env)
#
# Run it as the user that runs PM2 (same as scripts/vps-update.sh).
# Atlas address: MONGODB_URI in backend/.env (or ATLAS_URI=... in front of the command).
# Local address: /root/.reifexa-mongo-credentials (written by install-mongodb.sh)
#                or LOCAL_MONGODB_URI=... in front of the command.
set -euo pipefail

MODE="${1:-}"
ROOT="${REIFEXA_ROOT:-/var/www/agency-site/reifencheck}"
BACKEND="${BACKEND:-$ROOT/backend}"
ENV_FILE="$BACKEND/.env"
CRED_FILE="/root/.reifexa-mongo-credentials"
DUMP_DIR="${DUMP_DIR:-/var/backups/mongodb/migration}"
API_PORT="${PORT:-8004}"

say()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

case "$MODE" in trial|final|rollback) ;; *) sed -n '2,12p' "$0"; exit 2 ;; esac
[ -f "$ENV_FILE" ] || die "No .env at $ENV_FILE (set REIFEXA_ROOT or BACKEND)"

env_get() { grep -E "^$1=" "$ENV_FILE" | tail -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//'; }

# ---------- rollback ----------
if [ "$MODE" = rollback ]; then
  last=$(ls -1t "$ENV_FILE".atlas-backup-* 2>/dev/null | head -1 || true)
  [ -n "$last" ] || die "No .env backup found – nothing to roll back."
  say "Restoring $last → .env (back to Atlas)"
  cp "$ENV_FILE" "$ENV_FILE.selfhost-$(date +%Y%m%d-%H%M%S)"
  cp "$last" "$ENV_FILE"
  pm2 restart reifexa-api awin-cron --update-env
  echo "Back on Atlas. Changes written to the VPS database since the switch are NOT in Atlas."
  exit 0
fi

# ---------- addresses ----------
ATLAS_URI="${ATLAS_URI:-$(env_get MONGODB_URI)}"
case "$ATLAS_URI" in
  *127.0.0.1*|*localhost*) die "MONGODB_URI in .env already points to this VPS. Pass the Atlas address: ATLAS_URI='mongodb+srv://…' bash $0 $MODE" ;;
  "") die "No Atlas address found (MONGODB_URI in .env or ATLAS_URI)" ;;
esac
if [ -z "${LOCAL_MONGODB_URI:-}" ]; then
  creds=$(cat "$CRED_FILE" 2>/dev/null || sudo -n cat "$CRED_FILE" 2>/dev/null || true)
  LOCAL_MONGODB_URI=$(printf '%s\n' "$creds" | grep '^LOCAL_MONGODB_URI=' | cut -d= -f2-)
fi
[ -n "$LOCAL_MONGODB_URI" ] || die "No local address. Run install-mongodb.sh first (or set LOCAL_MONGODB_URI)."
command -v mongodump >/dev/null || die "mongodump missing – run install-mongodb.sh first."

dbname() { (cd "$BACKEND" && URI="$1" node -e 'const {MongoClient}=require("mongodb");const c=new MongoClient(process.env.URI);c.connect().then(()=>{console.log(c.db().databaseName);return c.close()}).catch(e=>{console.error(e.message);process.exit(1)})'); }
SRC_DB=$(dbname "$ATLAS_URI") || die "Cannot connect to Atlas."
DST_DB=$(dbname "$LOCAL_MONGODB_URI") || die "Cannot connect to the local MongoDB."
say "Atlas database: $SRC_DB  →  VPS database: $DST_DB"

# ---------- final: stop writers ----------
if [ "$MODE" = final ]; then
  if (cd "$BACKEND" && node scripts/awin-sync-now.mjs --status) >/dev/null 2>&1; [ $? -eq 3 ]; then
    die "An AWIN import is running right now. Wait until it is finished (bash scripts/vps-update.sh status) and start again."
  fi
  echo "The API and the AWIN cron will be stopped for a few minutes while the data is copied."
  read -r -p "Type MOVE to continue: " ok
  [ "$ok" = MOVE ] || die "Cancelled."
  say "Stopping reifexa-api and awin-cron"
  pm2 stop reifexa-api awin-cron >/dev/null
  trap 'warn "Something failed – starting the apps again on Atlas"; pm2 restart reifexa-api awin-cron --update-env >/dev/null' ERR
fi

# ---------- copy ----------
mkdir -p "$DUMP_DIR"
ARCHIVE="$DUMP_DIR/atlas-$SRC_DB-$(date +%Y%m%d-%H%M%S).archive.gz"
say "Downloading everything from Atlas → $ARCHIVE"
mongodump --uri="$ATLAS_URI" --db="$SRC_DB" --archive="$ARCHIVE" --gzip
ls -lh "$ARCHIVE" | awk '{print "   size:", $5}'

say "Loading it into the VPS database (replaces what is there)"
mongorestore --uri="$LOCAL_MONGODB_URI" --archive="$ARCHIVE" --gzip --drop \
  --nsInclude="$SRC_DB.*" --nsFrom="$SRC_DB.*" --nsTo="$DST_DB.*"

say "Checking every collection (documents + indexes)"
if ! (cd "$BACKEND" && SOURCE_URI="$ATLAS_URI" TARGET_URI="$LOCAL_MONGODB_URI" SOURCE_DB="$SRC_DB" TARGET_DB="$DST_DB" \
      node scripts/mongo-selfhost/verify-copy.mjs); then
  if [ "$MODE" = trial ]; then
    warn "Small differences are normal in a trial – the live site keeps writing to Atlas while copying."
  else
    die "The copy does not match. The site was NOT switched."
  fi
fi

if [ "$MODE" = trial ]; then
  say "Trial finished. The site still uses Atlas. When you are ready:"
  echo "  bash scripts/mongo-selfhost/migrate.sh final"
  exit 0
fi

# ---------- final: switch ----------
BACKUP="$ENV_FILE.atlas-backup-$(date +%Y%m%d-%H%M%S)"
cp "$ENV_FILE" "$BACKUP"; chmod 600 "$BACKUP"
say "Switching MONGODB_URI in .env to the VPS (old .env saved as $(basename "$BACKUP"))"
grep -v '^MONGODB_URI=' "$BACKUP" > "$ENV_FILE.tmp"
printf 'MONGODB_URI=%s\n' "$LOCAL_MONGODB_URI" >> "$ENV_FILE.tmp"
mv "$ENV_FILE.tmp" "$ENV_FILE"; chmod 600 "$ENV_FILE"
trap - ERR

say "Starting reifexa-api and awin-cron on the VPS database"
pm2 restart reifexa-api awin-cron --update-env >/dev/null
pm2 save >/dev/null || true
for _ in $(seq 1 30); do curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1 && break; sleep 2; done
if curl -fsS "http://127.0.0.1:$API_PORT/health" >/dev/null 2>&1; then
  say "✅ Done – Reifexa now runs on the MongoDB on this VPS."
else
  warn "The API does not answer /health yet. Check: pm2 logs reifexa-api --lines 50"
  warn "To go back to Atlas: bash scripts/mongo-selfhost/migrate.sh rollback"
fi
echo "Keep the Atlas cluster for a few days before deleting it. Set up daily backups:"
echo "  sudo bash scripts/mongo-selfhost/backup.sh install"
