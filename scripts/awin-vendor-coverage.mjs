#!/usr/bin/env node
/**
 * AWIN vendor coverage report — read-only, touches no database.
 *
 *   node scripts/awin-vendor-coverage.mjs                 # downloads AWIN_CSV_URL
 *   node scripts/awin-vendor-coverage.mjs ./feed.csv      # or a local CSV/ZIP
 *
 * Shows, per merchant, how many feed rows become an offer on a product and
 * why the rest don't (no EAN, no price, no AWIN link, product not sold by
 * reifen.com so the group is skipped). Also lists how many products end up
 * with 1, 2, 3+ vendors.
 */
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import csv from "csv-parser";
import AdmZip from "adm-zip";
import dotenv from "dotenv";
import { detectCsvSeparator } from "../src/api/utils/awinCsv.js";
import { getFeedProductKey, pickRowPrice } from "../src/api/utils/offerPricing.js";
import { hasAwinAffiliateLink } from "../src/api/utils/offerUtils.js";
import { isCarTyreGroup } from "../src/api/utils/validators.js";

dotenv.config();

async function loadCsvPath(arg) {
  let buf;
  if (arg) {
    buf = fs.readFileSync(arg);
  } else {
    const url = process.env.AWIN_CSV_URL;
    if (!url) throw new Error("Pass a CSV path or set AWIN_CSV_URL");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (buf.slice(0, 2).toString() === "PK") {
    const entry = new AdmZip(buf).getEntries().find((e) => /\.csv$/i.test(e.entryName));
    if (!entry) throw new Error("No CSV in ZIP");
    buf = entry.getData();
  } else if (buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = zlib.gunzipSync(buf);
  }
  const out = path.join(os.tmpdir(), `awin-coverage-${Date.now()}.csv`);
  fs.writeFileSync(out, buf);
  return out;
}

const file = await loadCsvPath(process.argv[2]);
const sep = detectCsvSeparator(file);
const groups = new Map();
const publisherIds = {};
const merchants = {};
const m = (name) =>
  (merchants[name] ||= { rows: 0, noKey: 0, noAwinLink: 0, noPrice: 0, groupSkipped: 0, onProducts: 0 });

await new Promise((resolve, reject) => {
  fs.createReadStream(file)
    .pipe(csv({ separator: sep }))
    .on("data", (row) => {
      const name = String(row.merchant_name || "unknown").trim();
      const s = m(name);
      s.rows++;
      if (!hasAwinAffiliateLink(row)) return s.noAwinLink++;
      try {
        const a = new URL(row.aw_deep_link).searchParams.get("a") || "missing";
        publisherIds[a] = (publisherIds[a] || 0) + 1;
      } catch { /* ignore */ }
      const key = getFeedProductKey(row);
      if (!key) return s.noKey++;
      if (!(pickRowPrice(row) > 0)) return s.noPrice++;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    })
    .on("end", resolve)
    .on("error", reject);
});

const vendorHistogram = {};
let imported = 0;
for (const rows of groups.values()) {
  const ok = isCarTyreGroup(rows);
  const vendors = new Set(rows.map((r) => String(r.merchant_name || "").trim()));
  for (const r of rows) {
    const s = m(String(r.merchant_name || "unknown").trim());
    if (ok) s.onProducts++;
    else s.groupSkipped++;
  }
  if (ok) {
    imported++;
    const n = vendors.size >= 4 ? "4+" : String(vendors.size);
    vendorHistogram[n] = (vendorHistogram[n] || 0) + 1;
  }
}

console.log(`\nFeed: ${file}`);
console.log(`Product groups in feed: ${groups.size}  →  imported (has reifen.com car-tyre row): ${imported}`);
console.log("Products by number of vendors:", vendorHistogram);
const expectedA = process.env.AWIN_AFFILIATE_ID || process.env.AWIN_PUBLISHER_ID || "2985775";
console.log(`AWIN publisher id (a=) in links:`, publisherIds, `expected: ${expectedA}`);
if (Object.keys(publisherIds).some((a) => a !== String(expectedA))) {
  console.log("⚠️  Some links carry a different publisher id — sales on those go to that account, not yours.");
}
console.log("\nPer merchant (rows → on products | lost: no EAN, no price, no AWIN link, group skipped):");
console.table(
  Object.entries(merchants)
    .sort((a, b) => b[1].rows - a[1].rows)
    .map(([name, s]) => ({
      merchant: name,
      rows: s.rows,
      onProducts: s.onProducts,
      "coverage %": s.rows ? Math.round((s.onProducts / s.rows) * 100) : 0,
      noEAN: s.noKey,
      noPrice: s.noPrice,
      noAwinLink: s.noAwinLink,
      groupSkipped: s.groupSkipped,
    }))
);
console.log(
  "\ngroupSkipped = the merchant sells this EAN but reifen.com doesn't (as a 'Reifen' car tyre), " +
    "so the whole product is skipped by isCarTyreGroup()."
);
fs.unlinkSync(file);
