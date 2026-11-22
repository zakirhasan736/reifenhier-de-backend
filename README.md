# reifenhier-de-backend
### German vehicle fitment

The initial target list is a curated catalogue of 302 model families for the
German market. Load the model names into the review queue, or generate size
suggestions in the same pass. Both commands can be resumed safely.

```sh
node scripts/seed-fitments.mjs scripts/fitment-models-de.json --catalogue 302
node scripts/seed-fitments.mjs scripts/fitment-models-de.json --suggest 302
```

Set `MONGODB_URI`. Suggestions also require a valid Searchlight provider key
and `SEARCHLIGHT_MODEL`. Each uncached model can trigger a billable AI call.
The suggestion pass writes review candidates. Confirm each fitment against
manufacturer or CoC documentation that permits the intended use, then enter
the variant, inclusive year range, axle, size and source at `/admin-fitment`
with an existing admin JWT. Only reviewed fitments with records are published.
The existing Searchlight AI fallback remains advisory and can add candidates.

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
