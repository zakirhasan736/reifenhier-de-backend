#!/usr/bin/env bash
# Step 3 – daily backup of the VPS database (Atlas did this for you before).
#
#   sudo bash scripts/mongo-selfhost/backup.sh            # make a backup now
#   sudo bash scripts/mongo-selfhost/backup.sh install    # every night at 03:30 (cron)
#   sudo bash scripts/mongo-selfhost/backup.sh restore FILE   # load a backup back in (replaces data)
#
# Backups: /var/backups/mongodb/daily, kept KEEP_DAYS days (default 14).
# Optional copy to another place (strongly recommended – a backup on the same
# server is lost if the server is lost): set RCLONE_REMOTE, e.g. "b2:reifexa-backups",
# after configuring rclone (rclone config).
set -euo pipefail

CRED_FILE="/root/.reifexa-mongo-credentials"
DIR="${BACKUP_DIR:-/var/backups/mongodb/daily}"
KEEP_DAYS="${KEEP_DAYS:-14}"
SELF="$(readlink -f "$0")"

[ "$(id -u)" = 0 ] || { echo "Please run with sudo."; exit 1; }
URI=$(grep '^LOCAL_MONGODB_URI=' "$CRED_FILE" | cut -d= -f2-)
DB=$(printf '%s' "$URI" | sed -E 's#^mongodb://[^/]+/([^?]+).*#\1#')

case "${1:-now}" in
  install)
    line="30 3 * * * RCLONE_REMOTE=${RCLONE_REMOTE:-} KEEP_DAYS=$KEEP_DAYS bash $SELF now >> /var/log/reifexa-mongo-backup.log 2>&1"
    ( crontab -l 2>/dev/null | grep -v "mongo-selfhost/backup.sh" ; echo "$line" ) | crontab -
    echo "✔ Nightly backup at 03:30 installed. Log: /var/log/reifexa-mongo-backup.log"
    ;;
  now)
    mkdir -p "$DIR"; chmod 700 "$DIR"
    f="$DIR/reifexa-$(date +%Y%m%d-%H%M%S).archive.gz"
    mongodump --uri="$URI" --db="$DB" --archive="$f" --gzip --quiet
    echo "$(date '+%F %T') ✔ backup $(du -h "$f" | cut -f1) $f"
    find "$DIR" -name 'reifexa-*.archive.gz' -mtime +"$KEEP_DAYS" -delete
    if [ -n "${RCLONE_REMOTE:-}" ] && command -v rclone >/dev/null; then
      rclone copy "$f" "$RCLONE_REMOTE" && echo "  ↳ copied to $RCLONE_REMOTE"
    fi
    ;;
  restore)
    f="${2:-}"; [ -f "$f" ] || { echo "Usage: backup.sh restore /var/backups/mongodb/daily/<file>"; exit 2; }
    read -r -p "This REPLACES the current data with $f. Type RESTORE: " ok
    [ "$ok" = RESTORE ] || exit 1
    mongorestore --uri="$URI" --archive="$f" --gzip --drop --nsInclude="$DB.*"
    echo "✔ Restored. Restart the apps: pm2 restart reifexa-api awin-cron"
    ;;
  *) sed -n '2,12p' "$0"; exit 2 ;;
esac
