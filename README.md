# reifenhier-de-backend
### German vehicle fitment

Reifexa keeps its own vehicle → tyre-size table (`fitmentvehicles`): one document
per model family (VW Golf, BMW 3er …) with all generations, build years and
factory tyre sizes per axle, plus `rank` (1 = most common in Germany).

**Fill it with the AI** (Anthropic, needs `ANTHROPIC_API_KEY` and `MONGODB_URI`):

```sh
node scripts/fitment-ai-fill.mjs --step fill --limit 20   # try 20 models first
node scripts/fitment-ai-fill.mjs                          # everything (resumable, Ctrl+C to pause)
node scripts/fitment-ai-fill.mjs --status                 # what is in the database
```

Steps: load the 866 names of `scripts/fitment-models-de.json` → ask the AI for all
models of each make (adds missing ones, estimates popularity) → per model all
generations with years and sizes, most common first → rank. `FITMENT_MODEL`
(default `claude-haiku-5-5`) chooses the model; the script prints tokens and cost.

AI records are saved as *KI-Vorschlag … bitte prüfen* and the model stays
`reviewed: false`. Check and correct them at `/admin-fitment` (admin JWT); a
reviewed model is never changed by the AI again. Searchlight also asks the AI
once for a car that is missing and saves it (the table grows by itself).
The website box "Passt z. B. auf" and the API mark reviewed models with
`verified: true`.

To validate and then import source-reviewed fitments in bulk, supply a JSON
array of objects containing `make`, `model` and a `fitments` array. Each
fitment needs `variant`, `yearFrom`, `yearTo` (inclusive), `size`, `axle`
(`front`, `rear`, or `both`) and `source`. Repeated imports merge matching
records into the listed model without creating duplicates. Run `--check`
without a database to validate the file.

```sh
node scripts/import-reviewed-fitments.mjs reviewed.json --check
node scripts/import-reviewed-fitments.mjs reviewed.json --apply
```

Plans (`src/api/fitment/data.js`) give access to the top N models by `rank`;
size search and load/speed index are in Pro and Advanced. The OpenAPI file is
public at `/api/fitment/openapi.json`, usage at `GET /api/fitment/v1/usage`.

Use `GET /api/fitment/v1/vehicles?make=VW&model=Golf&year=2018` with an
approved API key and IP to filter by model year. It also accepts a tyre size
to find the model variants with that size in the requested year.

The public website links to `/auto-api`. Applications capture the business
email, plan, accepted terms version and requested public egress addresses.
Review the application, invoice paid plans manually and approve access after
payment. Deliver the one-time key securely. Revoke access on cancellation or
when the customer needs a replacement key or new IPs, then approve a new
application. The public request form does not collect payment.

For direct traffic, the API uses the socket IP. Behind a single trusted ingress,
set `FITMENT_TRUSTED_PROXY_IP` to the exact address of the immediate peer.
The ingress must overwrite `X-Fitment-Client-IP` using the verified client
address and block direct access to the origin. Configure and test from both an
approved and a different IP before issuing production keys. The API checks the
allowlisted IP and bearer key, and counts requests per key/day in MongoDB.

### Homepage visitor map

The Express server serves public aggregate GA4 data at GET /api/live-traffic.
Enable the Analytics Data API and grant the service account Viewer access to
the Reifexa property. Configure GA4_PROPERTY_ID and GOOGLE_APPLICATION_CREDENTIALS
(the absolute path of the private service-account file on the backend). Set
GA4_STREAM_ID to restrict reports to the Reifexa stream for a shared property.
Restart the API after changing its environment. A successful response has
updatedAt, last30, last5, minutes, cities, pages and acquisition. When recent
data is unavailable the API returns 503. No MongoDB migration is required.
