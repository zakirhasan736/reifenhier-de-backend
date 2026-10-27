#!/usr/bin/env node
/**
 * Pull the AWIN feed NOW, import every product/price, then verify that each
 * shop's prices on reifexa match the feed exactly.
 *
 *   node scripts/awin-sync-now.mjs                    # full sync + check
 *   node scripts/awin-sync-now.mjs --check-only       # no import, only compare
 *   node scripts/awin-sync-now.mjs --vendor reifen.com
 *   node scripts/awin-sync-now.mjs --file ./feed.csv  # use a downloaded feed
 *   node scripts/awin-sync-now.mjs --status           # is an import running? (exit 0 idle, 3 running)
 *   node scripts/awin-sync-now.mjs --import-anyway    # import even if the cron just finished one
 *   node scripts/awin-sync-now.mjs --scrape           # also run review scraper + image sync
 *
 * Exit code 0 = all imported prices match the feed, 1 = problems found.
 * Safe to run while the cron is active: if the cron is importing right now,
 * this waits for it to finish (showing its progress) and then only verifies.
 * A lock left by a dead process (no heartbeat for 10 min) is released.
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
import { detectCsvSeparator } from "../src/api/utils/awinCsv.js";
import { getFeedProductKey, pickRowPrice, parseInStock } from "../src/api/utils/offerPricing.js";
import { hasAwinAffiliateLink } from "../src/api/utils/offerUtils.js";
import { getLockState, releaseStaleLock, waitForImportIdle } from "../src/api/utils/importLock.js";
import { downloadAwinFeed } from "../src/api/utils/awinFeedDownload.js";

dotenv.config();

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f) => (args.indexOf(f) >= 0 ? args[args.indexOf(f) + 1] : undefined);
const CHECK_ONLY = flag("--check-only");
const STATUS = flag("--status");
const IMPORT_ANYWAY = flag("--import-anyway");
const SCRAPE = flag("--scrape");
const VENDOR = String(opt("--vendor") || "").trim().toLowerCase();
const FILE = opt("--file");
const EXPECTED_A = process.env.AWIN_AFFILIATE_ID || process.env.AWIN_PUBLISHER_ID || "2985775";

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
    // shop by shop, unchanged shops from cache, retries; falls back to one download
    let dl;
    try {
      dl = await downloadAwinFeed(process.env.AWIN_CSV_URL, { log: (m) => log(m) });
    } catch (e) {
      fail(e.message);
    }
    if (dl.feeds.length) {
      console.log("");
      console.table(dl.feeds.map((f) => ({ Shop: f.name, "Feed-ID": f.fid, Status: f.status, Zeilen: f.rows, MB: +(f.bytes / 1048576).toFixed(1) })));
    }
    return dl.file;
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
  const totalOnSite = report.reduce((n, r) => n + r["auf reifexa"], 0);
  if (totalOnSite === 0) {
    console.log("\n❌ Keine einzige Feed-Position ist auf reifexa zu finden – Import fehlgeschlagen oder falsche Datenbank (MONGODB_URI).");
    problems += 1;
  }
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

if (STATUS) {
  const s = await getLockState();
  const m = await ImportMeta.findOne({ source: "AWIN" }).lean();
  console.log(
    s.running
      ? `Import ${s.alive ? "RUNNING" : "STUCK (process gone)"} — started ${s.startedMinAgo} min ago, ${s.progress}% done, heartbeat ${s.heartbeatSecAgo}s ago`
      : `No import running. Last successful import: ${m?.lastSuccess ? new Date(m.lastSuccess).toLocaleString("de-DE") : "never"}`
  );
  await mongoose.disconnect();
  process.exit(s.running && s.alive ? 3 : 0);
}

// If the cron is importing right now, wait for it instead of fighting it.
let freshFromCron = false;
if (!CHECK_ONLY) {
  const s = await getLockState();
  if (s.running && s.alive) {
    log(`The cron is importing right now (${s.progress}% done) — waiting for it to finish…`);
    const r = await waitForImportIdle({
      onWait: (st) => log(`  … still importing: ${st.progress}% (heartbeat ${st.heartbeatSecAgo}s ago)`),
    });
    if (r.timedOut) fail("The running import did not finish within 90 min. Check `pm2 logs awin-cron`.");
    freshFromCron = !r.releasedStale;
    if (freshFromCron) log("Cron import finished.");
  } else if (s.running) {
    log(`Releasing a dead import lock (no heartbeat for ${Math.round(s.heartbeatSecAgo / 60)} min).`);
    await releaseStaleLock();
  }
}

const feedFile = await getFeedFile();
const feed = await readFeed(feedFile);
log(`Feed: ${feed.rows.toLocaleString("de-DE")} rows from ${feed.shops.size} shops`);

if (!CHECK_ONLY && freshFromCron && !IMPORT_ANYWAY) {
  log("Skipping our own import: the cron just imported the same feed. Verifying prices…");
} else if (!CHECK_ONLY) {
  const again = await getLockState();
  if (again.running && again.alive) fail("Another import started in the meantime. Run this again in a few minutes.");
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
