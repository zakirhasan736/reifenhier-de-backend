# Sentry error tracking (API + cron)

1. Create a free account at https://sentry.io (choose the **EU / Frankfurt** data region).
2. New project → platform **Node.js / Express** → copy the DSN.
3. On the server add to `/var/www/agency-site/reifencheck/backend/.env`:

```
SENTRY_DSN=https://xxxx@oxxxx.ingest.de.sentry.io/xxxx
SENTRY_ENVIRONMENT=production
# optional: sample 5 % of requests for performance
# SENTRY_TRACES_SAMPLE_RATE=0.05
```

4. `npm ci && pm2 restart reifexa-api awin-cron` – the log shows `[sentry] error tracking on`.

Without `SENTRY_DSN` nothing is sent. Cookies, auth headers, e-mail addresses and user
details are removed before an error leaves the server (`src/instrument.js`).
