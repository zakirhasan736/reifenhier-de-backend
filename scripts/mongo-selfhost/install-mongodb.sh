#!/usr/bin/env bash
# Step 1 – install MongoDB 8.0 on this VPS (Ubuntu 22.04 / 24.04), locked down:
#   * listens only on 127.0.0.1 (not reachable from the internet)
#   * login required (admin user + one app user for Reifexa)
#   * memory cache capped so the API and the AWIN cron keep enough RAM
#
#   sudo bash scripts/mongo-selfhost/install-mongodb.sh
#
# Safe to run again: existing users and data are kept.
set -euo pipefail

DB_NAME="${DB_NAME:-reifexa}"
APP_USER="${APP_USER:-reifexa_app}"
CRED_FILE="/root/.reifexa-mongo-credentials"

say()  { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✖ %s\033[0m\n' "$*"; exit 1; }

[ "$(id -u)" = 0 ] || die "Please run with sudo."
. /etc/os-release
case "$VERSION_CODENAME" in
  jammy|noble) ;;
  *) die "This script supports Ubuntu 22.04 (jammy) and 24.04 (noble). Found: $PRETTY_NAME" ;;
esac

# ---------- 1. packages ----------
if ! command -v mongod >/dev/null; then
  say "Installing MongoDB 8.0 for Ubuntu $VERSION_CODENAME"
  apt-get update -y
  apt-get install -y gnupg curl
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg --yes
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu $VERSION_CODENAME/mongodb-org/8.0 multiverse" \
    > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -y
  apt-get install -y mongodb-org   # mongod, mongosh, mongodump/mongorestore
else
  say "MongoDB already installed: $(mongod --version | head -1)"
fi

# ---------- 2. config ----------
RAM_GB=$(awk '/MemTotal/ {printf "%.1f", $2/1024/1024}' /proc/meminfo)
# API (~1.5 GB) + AWIN cron (~2 GB) + Next.js need RAM too → give MongoDB ~25 % (min 0.5 GB)
CACHE_GB=$(awk -v r="$RAM_GB" 'BEGIN { c = r * 0.25; if (c < 0.5) c = 0.5; printf "%.1f", c }')
say "RAM ${RAM_GB} GB → MongoDB cache ${CACHE_GB} GB"

write_conf() {  # $1 = enabled|disabled (authorization)
  cat > /etc/mongod.conf <<CONF
# Reifexa – written by scripts/mongo-selfhost/install-mongodb.sh
storage:
  dbPath: /var/lib/mongodb
  wiredTiger:
    engineConfig:
      cacheSizeGB: ${CACHE_GB}
systemLog:
  destination: file
  logAppend: true
  path: /var/log/mongodb/mongod.log
net:
  port: 27017
  bindIp: 127.0.0.1
processManagement:
  timeZoneInfo: /usr/share/zoneinfo
security:
  authorization: $1
CONF
}

if [ -f "$CRED_FILE" ]; then
  say "Users already created earlier (credentials in $CRED_FILE)"
  write_conf enabled
  systemctl enable --now mongod
  systemctl restart mongod
else
  # first run: start without login, create the users, then switch login on
  write_conf disabled
  systemctl enable --now mongod
  systemctl restart mongod
  for _ in $(seq 1 30); do mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && break; sleep 1; done

  ADMIN_PW=$(openssl rand -hex 24)
  APP_PW=$(openssl rand -hex 24)
  say "Creating users (admin + $APP_USER on database $DB_NAME)"
  mongosh --quiet admin --eval "
    db.createUser({ user: 'admin', pwd: '$ADMIN_PW', roles: [ { role: 'root', db: 'admin' } ] });
    db.getSiblingDB('$DB_NAME').createUser({ user: '$APP_USER', pwd: '$APP_PW', roles: [ { role: 'readWrite', db: '$DB_NAME' } ] });
  "
  umask 077
  cat > "$CRED_FILE" <<CRED
# Reifexa MongoDB – keep this file private (root only)
MONGO_ADMIN_URI=mongodb://admin:${ADMIN_PW}@127.0.0.1:27017/admin
LOCAL_MONGODB_URI=mongodb://${APP_USER}:${APP_PW}@127.0.0.1:27017/${DB_NAME}?authSource=${DB_NAME}
CRED
  write_conf enabled
  systemctl restart mongod
fi

for _ in $(seq 1 30); do mongosh --quiet --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1 && break; sleep 1; done
systemctl is-active --quiet mongod || die "mongod is not running – see: journalctl -u mongod -n 50"

# make sure 27017 is never open to the internet, even if bindIp is changed later
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw deny 27017/tcp >/dev/null || true
fi

say "Done. MongoDB $(mongod --version | awk 'NR==1{print $3}') is running on 127.0.0.1:27017 with login."
echo "Credentials: $CRED_FILE (root only). Next step:"
echo "  sudo bash scripts/mongo-selfhost/migrate.sh trial"
