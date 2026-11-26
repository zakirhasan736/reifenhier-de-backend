# Reifencheck on a single Linux VPS

The existing Node API and PM2 worker run on the host. MongoDB runs in an official MongoDB Docker container using host networking, bound only to 127.0.0.1:27018. A single-member replica set supports transactions but has no failover. The script does not change application settings or stop PM2. Run the migration from a private root terminal. Never put credentials or archives in the repository, a public web directory, or shell arguments.

## 1. Check the server and the current database

From the running backend directory (beside package.json and .env), using its normal Node environment:

```sh
node --input-type=module -e 'import "./src/loadEnv.js"; import mongoose from "mongoose"; await mongoose.connect(process.env.MONGODB_URI); console.log("DB:", mongoose.connection.name); await mongoose.disconnect()'
pm2 ls
cat /etc/os-release
df -h /var/lib
free -h
ss -lnt | awk '$4 ~ /:27018$/'
```

Use the PM2 account that owns the running services. If PM2 injects a separate MONGODB_URI, confirm its database privately and update that same configuration at cutover. Check the Atlas server version and storage in the Atlas dashboard. Compare available VPS storage against all source collections and indexes, the dump archive, journal/oplog, index builds and projected growth. Mount any dedicated persistent volume at /var/lib/reifencheck-mongodb before setup. Give MongoDB and the existing Node processes adequate RAM. Port 27018 must be unused.

Rotate any Atlas credential shared in a message. Update the live backend's Atlas credential and verify it connects before scheduling the migration. For migration, allow the VPS outbound IP in Atlas and create a temporary read-only login able to enumerate and read **every** intended application database. Cross-check inventory against Atlas Data Explorer. Partial access yields a partial inventory.

## 2. Install Docker if needed

Run `docker version`. If the server section works, skip installation. On a fresh supported Ubuntu host with no conflicting Docker packages, run as root:

```sh
apt-get update
apt-get install -y ca-certificates curl python3
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
. /etc/os-release
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME:-$VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io
systemctl enable --now docker
docker version
```

For other distributions or an existing container runtime follow the matching installation procedure at https://docs.docker.com/engine/install/ . Avoid uninstalling a runtime serving existing workloads. Keep the VPS firewall closed to public MongoDB traffic.

## 3. Set up and inspect

From the folder containing migrate.py, choose the version series shown in Atlas (example 8.0):

```sh
python3 migrate.py setup --series 8.0
python3 migrate.py inventory
```

Enter the read-only Atlas URI at the hidden prompt. Include the rotated migration credentials in the URI, percent-encoding special characters. The inventory checks the source version series against the chosen server. Start with an empty state directory. If setup stops, inspect `docker logs reifencheck-mongodb` and the state directory before retrying. Keep generated credentials. Do not clear a populated destination.

## 4. Maintenance window and copy

Test this procedure first on a disposable VPS if downtime is tight. Allow time for the dump, index builds and exact counts. Enable maintenance mode at your reverse proxy, drain active requests/jobs, then stop both project processes with the same PM2 account. Check for other writers and scheduled tasks outside PM2. Atlas triggers and TTL expiration can still modify records. Arrange a stable source throughout the copy. Inventory and plan equivalents for Atlas Search, Vector Search, triggers and other managed features before cutover.

```sh
pm2 stop reifexa-api awin-cron
python3 migrate.py copy
```

Use the same read-only migration login, confirm the displayed database list, and enter the actual backend database name from step 1. The script archives each visible application database, restores it under its original name, and compares the collection lists, counts, index definitions, views and collection options. It also rechecks the source manifest. These checks are not a byte-for-byte comparison. GridFS collections are included. Atlas users, system databases, provider backups, sharding configuration and external image files (such as Cloudinary assets) are outside this copy. The generated backend user has readWrite only on the selected application database.

If copying fails, keep maintenance on while deciding whether to retry. The tool refuses a populated target. Inspect the error, preserve archives, and use a fresh destination for a clean retry. To resume normal service on Atlas before cutover, start the stopped processes with their original settings and leave the VPS copy unused.

## 5. Switch the backend

The actual generated connection line is in /var/lib/reifencheck-mongodb/backend.env (root only). View it privately. Back up the backend's existing .env in a root-only folder. Replace only MONGODB_URI in the backend's existing .env with the generated line. Preserve other keys and the file's owner/mode. If the process manager sets this variable, update its authoritative configuration too; a pre-existing environment variable takes precedence over dotenv. Restart both services using their normal PM2 owner and environment.

```sh
# From the running backend directory as root, before editing
install -d -m 700 /root/reifencheck-config-backups
install -m 600 .env "/root/reifencheck-config-backups/backend.env.$(date +%Y%m%d-%H%M%S)"
cat /var/lib/reifencheck-mongodb/backend.env
# Replace only MONGODB_URI in .env
nano .env
```

Keep ingress in maintenance until smoke tests pass. Start the API, test a DB-backed product lookup, an older image URL and one controlled write. Confirm the new record in the local database. The API can stay online without MongoDB, so an HTTP health response alone is insufficient. Then start the worker, inspect logs and reopen traffic.

```sh
pm2 restart reifexa-api --update-env
pm2 logs reifexa-api --lines 30 --nostream
# After the DB-backed smoke test succeeds:
pm2 restart awin-cron --update-env
pm2 logs awin-cron --lines 30 --nostream
```

Before any new VPS writes, rollback means pointing both processes at the saved Atlas settings and restarting. After the first VPS write, capture and reconcile changes before switching back. Keep Atlas available until verification, scheduled encrypted off-VPS backups, and a restore drill are complete. Remove the temporary Atlas migration login and IP rule once no longer needed.

## Locations

| Item | Location |
| --- | --- |
| Data files | /var/lib/reifencheck-mongodb/data |
| Copy archives | /var/lib/reifencheck-mongodb/archives |
| Generated application URL | /var/lib/reifencheck-mongodb/backend.env |
| Administrator credentials and replica key | /var/lib/reifencheck-mongodb/settings.json and replica.key |
| Local MongoDB listener | 127.0.0.1:27018 |

The URL is for a backend running directly on the same Linux host. A Dockerized or remote backend needs a different network arrangement. Keep the archives and credentials off the web server's document root. Monitor disk space and MongoDB memory usage after switching.
