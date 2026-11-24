# Move Reifexa from MongoDB Atlas to the VPS

The backend reads the database address from one setting, `MONGODB_URI` in `backend/.env`.
No Atlas-only features are used (no Atlas Search, change streams or transactions),
so the move is: install MongoDB on the VPS → copy the data → change that one line.

Everything below runs on the VPS in `/var/www/agency-site/reifencheck/backend`.

## Before you start

- **Disk:** free space should be at least 3× the database size shown in Atlas
  (data + one copy of the download + daily backups). Check with `df -h /var/lib`.
- **RAM:** MongoDB gets about 25 % of the RAM (set automatically). With 8 GB or more
  everything fits comfortably next to the API, the AWIN cron and Next.js.
- **Ubuntu** 22.04 or 24.04 (`lsb_release -a`).
- Pull this code first: `bash scripts/vps-update.sh backend`.

## 1. Install MongoDB (5 min, the site keeps running)

```bash
sudo bash scripts/mongo-selfhost/install-mongodb.sh
```

Installs MongoDB 8.0, listens **only on 127.0.0.1** (not reachable from the internet),
turns login on, and creates two users with random passwords. The passwords are written to
`/root/.reifexa-mongo-credentials` (readable by root only).

## 2. Trial copy (the site keeps using Atlas)

```bash
bash scripts/mongo-selfhost/migrate.sh trial
```

Downloads everything from Atlas, loads it into the VPS database and compares every
collection (number of documents + indexes). Small differences are normal here because
the live site keeps writing to Atlas during the copy. This shows how long the real move
takes and that everything fits.

## 3. Real move (a few minutes of API downtime)

Pick a quiet time and make sure no AWIN import is running (`bash scripts/vps-update.sh status`).

```bash
bash scripts/mongo-selfhost/migrate.sh final
```

1. stops `reifexa-api` and `awin-cron` (no new writes),
2. copies everything from Atlas again,
3. checks that every collection matches exactly – **if not, nothing is switched**
   and the apps start again on Atlas,
4. saves the old `.env` as `.env.atlas-backup-<date>` and points `MONGODB_URI` to the VPS,
5. restarts both apps and checks `/health`.

The website pages from Next.js stay online during the move. Only API calls (prices, search,
clicks) fail for those few minutes.

**Something wrong?** Go back to Atlas at any time:

```bash
bash scripts/mongo-selfhost/migrate.sh rollback
```

(Data written to the VPS database after the switch is not in Atlas.)

## 4. Daily backups (Atlas did this for you before)

```bash
sudo bash scripts/mongo-selfhost/backup.sh install        # every night at 03:30, kept 14 days
sudo bash scripts/mongo-selfhost/backup.sh                # one backup now
sudo bash scripts/mongo-selfhost/backup.sh restore <file> # load a backup back in
```

A backup that only lives on the same server is gone if the server is gone. Copy it somewhere
else too: install `rclone`, connect it to Backblaze B2 / Google Drive / S3 (`rclone config`)
and install the cron with `RCLONE_REMOTE=<remote>:<folder>` in front of the command.

## 5. After a few days

- Watch `pm2 logs reifexa-api` and the site for 2–3 days.
- Then delete the Atlas cluster (or pause it) to stop paying for it.
- Other places that still use the Atlas address (local `.env` files, admin tools) need the
  new address only if they run on the VPS – the database cannot be reached from outside.
  For a GUI like MongoDB Compass, use an SSH tunnel:
  `ssh -L 27017:127.0.0.1:27017 user@your-vps`, then connect Compass to `localhost:27017`
  with the credentials from `/root/.reifexa-mongo-credentials`.
