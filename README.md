# reifenhier-de-backend
### German vehicle fitment

The initial target list is a curated catalogue of 800 model names across 51 makes for the
German market, including current and older nameplates. The list is curated and has not been ranked by vehicle registrations. Load the names into the review queue with MongoDB configured.

```sh
node scripts/seed-fitments.mjs scripts/fitment-models-de.json --catalogue
```

Enter fitments from original measurements or sources permitted for the
intended use and resale. Record the variant, year range, axle, size and source
at `/admin-fitment` with an existing admin JWT. The website finder and
commercial API read reviewed records from Reifexa's database.

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
