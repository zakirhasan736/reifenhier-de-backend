#!/usr/bin/env node
/**
 * Pull the AWIN feed NOW, import every product/price, then verify that each
 * shop's prices on reifexa match the feed exactly.
 *
 *   node scripts/awin-sync-now.mjs                    # full sync + check
 *   node scripts/awin-sync-now.mjs --check-only       # no import, only compare
 *   node scripts/awin-sync-now.mjs --vendor reifen.com
 *   node scripts/awin-sync-now.mjs --file ./feed.csv  # use a downloaded feed
 *   node scripts/awin-sync-now.mjs --force            # take over a lock older than 30 min
 *   node scripts/awin-sync-now.mjs --scrape           # also run review scraper + image sync
 *
 * Exit code 0 = all imported prices match the feed, 1 = problems found.
 * Safe to run while the cron is active: it refuses to start if an import is
 * already running (unless that lock is stale and --force is given).
 */
import fs from "fs";
import os from "os";
import path from "path";
import zlib from "zlib";
import { spawn } from "child_process";
import csv from "csv-parser";
import AdmZip from "adm-zip";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../src/models/product.js";
import ImportMeta from "../src/models/ImportMeta.js";
import { importAWINCsv } from "../src/api/product/importAWINCsv.js";
import { detectCsvSeparator, parseAwinFeedMeta } from "../src/api/utils/awinCsv.js";
import { getFeedProductKey, pickRowPrice, parseInStock } from "../src/api/utils/offerPricing.js";
import { hasAwinAffiliateLink } from "../src/api/utils/offerUtils.js";

dotenv.config();

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : undefined);
const CHECK_ONLY = flag("--check-only");
const FORCE = flag("--force");
const SCRAPE = flag("--scrape");
const VENDOR = String(opt("--vendor") || "").trim().toLowerCase();
const FILE = opt("--file");
const EXPECTED_A = process.env.AWIN_AFFILIATE_ID || process.env.AWIN_PUBLISHER_ID || "2985775";
const STALE_LOCK_MS = 30 * 60 * 1000;

const t0 = Date.now();
const secs = () => `${((Date.now() - t0) / 1000).toFixed(0)}s`;
const log = (...a) => console.log(`[${secs()}]`, ...a);
const fail = (msg) => {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
};

// ------------------------------------------------------------------ feed
async function getFeedFile() {
  let buf;
  if (FILE) {
    buf = fs.readFileSync(FILE);
    log(`Using local feed ${FILE}`);
  } else {
    const url = process.env.AWIN_CSV_URL;
    if (!url) fail("AWIN_CSV_URL is not set in .env");
    const { cid } = parseAwinFeedMeta(url);
    log(`Downloading AWIN feed (campaign ${cid || "n/a"})…`);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15 * 60 * 1000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) fail(`Feed download failed: HTTP ${res.status} ${res.statusText}`);
      buf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      fail(`Feed download failed: ${e.message}`);
    } finally {
      clearTimeout(timer);
    }
    log(`Downloaded ${(buf.length / 1048576).toFixed(1)} MB`);
  }
  if (buf.slice(0, 2).toString() === "PK") {
    const entry = new AdmZip(buf).getEntries().find((e) => /\.csv$/i.test(e.entryName));
    if (!entry) fail("No CSV inside the AWIN ZIP");
    buf = entry.getData();
  } else if (buf[0] === 0x1f && buf[1] === 0x8b) {
    buf = zlib.gunzipSync(buf);
  }
  const header = buf.slice(0, 4000).toString("utf8").split(/\r?\n/)[0];
  for (const col of ["aw_deep_link", "merchant_name", "search_price"]) {
    if (!header.includes(col)) fail(`Feed is missing column "${col}". Header: ${header.slice(0, 200)}`);
  }
  const out = path.join(os.tmpdir(), `awin-sync-${Date.now()}.csv`);
  fs.writeFileSync(out, buf);
  return out;
}

/** Feed rows grouped per shop → per product key, best row (in stock, then cheapest). */
async function readFeed(file) {
  const shops = new Map(); // shopLower -> { name, rows, noAwin, noKey, noPrice, wrongA, products: Map(key -> {price,inStock}) }
  const shop = (name) => {
    const k = name.toLowerCase();
    if (!shops.has(k))
      shops.set(k, { name, rows: 0, noAwin: 0, noKey: 0, noPrice: 0, wrongA: 0, products: new Map() });
    return shops.get(k);
  };
  let rows = 0;
  await new Promise((resolve, reject) => {
    fs.createReadStream(file)
      .pipe(csv({ separator: detectCsvSeparator(file) }))
      .on("data", (r) => {
        rows++;
        const s = shop(String(r.merchant_name || "unbekannt").trim());
        s.rows++;
        if (!hasAwinAffiliateLink(r)) return void s.noAwin++;
        try {
          if (new URL(r.aw_deep_link).searchParams.get("a") !== String(EXPECTED_A)) s.wrongA++;
        } catch {
          /* ignore */
        }
        const key = getFeedProductKey(r);
        if (!key) return void s.noKey++;
        const price = pickRowPrice(r);
        if (!(price > 0)) return void s.noPrice++;
        const inStock = parseInStock(r.in_stock);
        const prev = s.products.get(key);
        if (!prev || (inStock && !prev.inStock) || (inStock === prev.inStock && price < prev.price)) {
          s.products.set(key, { price, inStock });
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });
  return { rows, shops };
}

// ------------------------------------------------------------------ verify
async function verify(feed) {
  log("Comparing every shop's prices on reifexa with the feed…");
  const db = new Map();
  const docs = await Product.find({}, { ean: 1, "offers.vendor": 1, "offers.price": 1, "offers.in_stock": 1 }).lean();
  for (const d of docs) db.set(String(d.ean), d.offers || []);

  const report = [];
  const mismatches = [];
  let problems = 0;
  for (const [k, s] of feed.shops) {
    if (VENDOR && k !== VENDOR) continue;
    let onSite = 0, match = 0, differ = 0, productMissing = 0, offerHidden = 0;
    for (const [ean, f] of s.products) {
      const offers = db.get(ean);
      if (!offers) { productMissing++; continue; }
      const o = offers.find((x) => String(x.vendor || "").trim().toLowerCase() === k);
      if (!o) { offerHidden++; continue; }
      onSite++;
      if (Math.abs(Number(o.price) - f.price) < 0.01) match++;
      else {
        differ++;
        if (mismatches.length < 30) mismatches.push({ shop: s.name, ean, reifexa: Number(o.price), feed: f.price });
      }
    }
    problems += differ + s.wrongA;
    report.push({
      Shop: s.name,
      "Zeilen im Feed": s.rows,
      "Produkte (EAN)": s.products.size,
      "auf reifexa": onSite,
      "Preis ✓": match,
      "Preis ✗": differ,
      "nicht importiert¹": productMissing,
      "ausgeblendet²": offerHidden,
      "ohne EAN": s.noKey,
      "ohne Preis": s.noPrice,
      "ohne AWIN-Link": s.noAwin,
      "falsche a=": s.wrongA,
    });
  }
  report.sort((a, b) => b["Zeilen im Feed"] - a["Zeilen im Feed"]);
  console.log("");
  console.table(report);
  console.log(
    "¹ Produkt hat keine reifen.com-PKW-Reifen-Zeile im Feed → wird bewusst nicht importiert (isCarTyreGroup).\n" +
      "² Angebot ausgeblendet: Shop meldet 'nicht auf Lager', während andere Shops liefern können."
  );
  if (mismatches.length) {
    console.log("\nPreisabweichungen (max. 30):");
    console.table(mismatches);
  }
  return problems;
}

// ------------------------------------------------------------------ main
await mongoose.connect(process.env.MONGODB_URI);
log("Connected to MongoDB");

const feedFile = await getFeedFile();
const feed = await readFeed(feedFile);
log(`Feed: ${feed.rows.toLocaleString("de-DE")} rows from ${feed.shops.size} shops`);

if (!CHECK_ONLY) {
  const meta = await ImportMeta.findOne({ source: "AWIN" }).lean();
  if (meta?.isRunning) {
    const age = Date.now() - new Date(meta.lastStarted || 0).getTime();
    if (age < STALE_LOCK_MS) fail(`An import is running right now (started ${Math.round(age / 60000)} min ago). Try again later or use --check-only.`);
    if (!FORCE) fail(`An import has been marked as running for ${Math.round(age / 60000)} min. If no import is running, re-run with --force.`);
    log(`Taking over stale import lock (${Math.round(age / 60000)} min old)`);
    await ImportMeta.updateOne({ source: "AWIN" }, { $set: { isRunning: false } });
  }
  log("Importing products and prices…");
  const ti = Date.now();
  try {
    await importAWINCsv(feedFile);
  } catch (e) {
    await ImportMeta.updateOne({ source: "AWIN" }, { $set: { isRunning: false, lastError: String(e?.message || e), lastErrorAt: new Date() } }).catch(() => {});
    fail(`Import failed: ${e?.message || e}`);
  }
  const m = await ImportMeta.findOne({ source: "AWIN" }).lean();
  log(
    `Import done in ${((Date.now() - ti) / 1000).toFixed(0)}s — neu: ${m?.imported ?? 0}, aktualisiert: ${m?.updated ?? 0}, ` +
      `unverändert: ${m?.skipped ?? 0}, gelöscht: ${m?.deleted ?? 0}`
  );
}

const problems = await verify(feed);

if (SCRAPE && !CHECK_ONLY) {
  for (const script of ["src/api/utils/scrapeMissingReifenData.js", "src/api/utils/uploadProductImages.js"]) {
    log(`Running ${script}…`);
    await new Promise((r) => spawn(process.execPath, [script], { stdio: "inherit" }).on("close", r));
  }
}

fs.unlinkSync(feedFile);
await mongoose.disconnect();
console.log(
  problems === 0
    ? `\n✅ Alle importierten Preise stimmen mit dem AWIN-Feed überein. (${secs()})`
    : `\n⚠️  ${problems} Abweichungen gefunden – siehe Tabellen oben. (${secs()})`
);
process.exit(problems === 0 ? 0 : 1);
