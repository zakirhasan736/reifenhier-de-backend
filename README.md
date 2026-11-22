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
