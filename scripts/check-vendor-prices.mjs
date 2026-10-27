#!/usr/bin/env node
/**
 * Read-only: compare the prices on reifexa (MongoDB) with the AWIN feed.
 *
 *   node scripts/check-vendor-prices.mjs                       # all shops, downloads AWIN_CSV_URL
 *   node scripts/check-vendor-prices.mjs --vendor reifen.com   # one shop
 *   node scripts/check-vendor-prices.mjs --vendor reifen.com ./feed.csv
 *
 * Lists offers whose stored price differs from the feed's selling price and
 * feed duplicates (same EAN + shop listed several times at different prices).
 * Writes nothing.
 */
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import csv from "csv-parser";
import AdmZip from "adm-zip";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../src/models/product.js";
import { detectCsvSeparator } from "../src/api/utils/awinCsv.js";
import { getFeedProductKey, pickRowPrice, parseInStock } from "../src/api/utils/offerPricing.js";

dotenv.config();

const args = process.argv.slice(2);
const vIdx = args.indexOf("--vendor");
const vendorFilter = vIdx >= 0 ? String(args[vIdx + 1] || "").toLowerCase() : "";
const fileArg = args.filter((a, i) => !a.startsWith("--") && i !== vIdx + 1)[0];

async function loadCsv() {
  let buf;
  if (fileArg) buf = fs.readFileSync(fileArg);
  else {
    const res = await fetch(process.env.AWIN_CSV_URL);
    if (!res.ok) throw new Error(`Feed download failed: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  }
  if (buf.slice(0, 2).toString() === "PK") buf = new AdmZip(buf).getEntries().find((e) => /\.csv$/i.test(e.entryName)).getData();
  else if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  const out = path.join(os.tmpdir(), `price-check-${Date.now()}.csv`);
  fs.writeFileSync(out, buf);
  return out;
}

const file = await loadCsv();
const feed = new Map(); // `${ean}|${vendor}` -> [{price, inStock}]
await new Promise((resolve, reject) => {
  fs.createReadStream(file)
    .pipe(csv({ separator: detectCsvSeparator(file) }))
    .on("data", (r) => {
      const vendor = String(r.merchant_name || "").trim();
      if (vendorFilter && vendor.toLowerCase() !== vendorFilter) return;
      const ean = getFeedProductKey(r);
      const price = pickRowPrice(r);
      if (!ean || !(price > 0)) return;
      const k = `${ean}|${vendor.toLowerCase()}`;
      if (!feed.has(k)) feed.set(k, []);
      feed.get(k).push({ price, inStock: parseInStock(r.in_stock) });
    })
    .on("end", resolve)
    .on("error", reject);
});

await mongoose.connect(process.env.MONGODB_URI);
let checked = 0, ok = 0, missingInFeed = 0;
const mismatches = [];
const cursor = Product.find({}, { ean: 1, slug: 1, offers: 1 }).lean().cursor();
for await (const p of cursor) {
  for (const o of p.offers || []) {
    const vendor = String(o.vendor || "").trim().toLowerCase();
    if (vendorFilter && vendor !== vendorFilter) continue;
    checked++;
    const rows = feed.get(`${p.ean}|${vendor}`);
    if (!rows) { missingInFeed++; continue; }
    const best = rows.filter((r) => r.inStock).sort((a, b) => a.price - b.price)[0] || rows.sort((a, b) => a.price - b.price)[0];
    if (Math.abs(Number(o.price) - best.price) < 0.01) ok++;
    else mismatches.push({ slug: p.slug, vendor: o.vendor, site: Number(o.price), feed: best.price, diff: +(Number(o.price) - best.price).toFixed(2) });
  }
}
await mongoose.disconnect();
fs.unlinkSync(file);

const dupes = [...feed.entries()].filter(([, r]) => new Set(r.map((x) => x.price)).size > 1);
console.log(`\nOffers checked: ${checked}${vendorFilter ? ` (${vendorFilter})` : ""}`);
console.log(`  match feed:      ${ok}`);
console.log(`  price differs:   ${mismatches.length}`);
console.log(`  not in feed now: ${missingInFeed}  (removed by the shop; next import drops them)`);
console.log(`Feed duplicates (same EAN + shop, different prices): ${dupes.length}`);
if (mismatches.length) {
  console.log("\nLargest differences (site − feed):");
  console.table(mismatches.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 25));
}
