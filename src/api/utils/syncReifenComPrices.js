// syncReifenComPrices.js — reifen.com only.
//
// Goes through the products one by one, opens each product's reifen.com
// page, reads the live price (and stock) and writes it onto the reifen.com
// offer. Best price, savings and price history are recomputed with the same
// logic as the AWIN import. Other vendors are not touched.
//
// The AWIN jobs keep a fresh live price (REIFEN_LIVE_PRICE_TTL_HOURS, default
// 26 h) instead of reverting it to the older feed price.
//
// Usage:
//   node src/api/utils/syncReifenComPrices.js                 # all products, oldest check first
//   node src/api/utils/syncReifenComPrices.js --limit 50      # first 50
//   node src/api/utils/syncReifenComPrices.js --slug <slug>   # one product
//   node src/api/utils/syncReifenComPrices.js --ean <ean>     # one product
//   node src/api/utils/syncReifenComPrices.js --dry-run       # show, don't write
//   node src/api/utils/syncReifenComPrices.js --stale-hours 12  # skip products checked in the last 12 h
//   node src/api/utils/syncReifenComPrices.js --browser       # use a real browser when reifen.com blocks
//   node src/api/utils/syncReifenComPrices.js --force         # also apply big price jumps (>50 %)
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import { computeOfferStats, dropOutOfStockWhenAlternatives } from "./offerPricing.js";
import { isReifenComOffer, reifenComProductUrl, REIFEN_COM_VENDOR_REGEX } from "./reifenCom.js";
import {
  parseReifenComPage,
  fetchReifenComHtml,
  fetchReifenComHtmlWithBrowser,
  closeBrowser,
} from "./reifenComLivePrice.js";
import { nextPriceTrend, recordPriceSnapshots } from "./priceHistory.js";
import { getLockState } from "./importLock.js";

dotenv.config();

/* ------------------------------ options ------------------------------ */
function argValue(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}
const has = (name) => process.argv.includes(`--${name}`);

const OPTS = {
  limit: Number(argValue("limit") || process.env.REIFEN_SYNC_LIMIT || 0),
  slug: argValue("slug"),
  ean: argValue("ean"),
  dryRun: has("dry-run") || String(process.env.REIFEN_SYNC_DRY_RUN || "") === "true",
  staleHours: Number(argValue("stale-hours") ?? process.env.REIFEN_SYNC_STALE_HOURS ?? 0),
  browser: has("browser") || String(process.env.REIFEN_SYNC_BROWSER || "") === "true",
  force: has("force"),
  delayMs: Number(argValue("delay") || process.env.REIFEN_SYNC_DELAY_MS || 800),
  maxJump: Number(process.env.REIFEN_SYNC_MAX_JUMP || 0.5),
  batch: 100,
};

const LiveProduct = mongoose.model("Product", Product.schema, "products");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------ fetching ----------------------------- */
async function readLivePrice(url) {
  let attempt = 0;
  let last = { reason: "not fetched" };
  while (attempt < 3) {
    attempt++;
    let { html, status, finalUrl } = await fetchReifenComHtml(url);
    if ((status === 403 || status === 503 || !html) && OPTS.browser) {
      ({ html, status, finalUrl } = await fetchReifenComHtmlWithBrowser(url));
    }
    if (status === 404 || status === 410) return { status, reason: "product page gone" };
    if (status === 429) {
      last = { status, reason: "rate limited" };
      await sleep(10000 * attempt);
      continue;
    }
    if (typeof status === "number" && status >= 400) {
      last = { status, reason: `HTTP ${status}${OPTS.browser ? "" : " (try --browser)"}` };
      await sleep(2000 * attempt);
      continue;
    }
    // Redirected to a search/category page = product no longer sold.
    if (finalUrl && !/reifen\.com\/.+/i.test(finalUrl)) return { status, reason: "redirected away" };
    return { status, finalUrl, ...parseReifenComPage(html) };
  }
  return last;
}

/* ------------------------------ one product -------------------------- */
async function syncProduct(doc, totals) {
  const offers = (doc.offers || []).map((o) => ({ ...o }));
  const offer = offers.find(isReifenComOffer);
  if (!offer) { totals.noOffer++; return; }

  const url = reifenComProductUrl(offer);
  if (!url) { totals.noUrl++; console.log(`–  ${doc.ean}  no reifen.com URL`); return; }

  const live = await readLivePrice(url);
  const stored = Number(offer.price) || 0;
  const now = new Date();

  if (!(live.price > 0)) {
    totals.unreadable++;
    console.log(`?  ${doc.ean}  stored ${stored}  live: ${live.reason}  ${url}`);
    if (!OPTS.dryRun) {
      // Record the failure only — keep the AWIN price.
      await LiveProduct.updateOne(
        { _id: doc._id, "offers.vendor": offer.vendor },
        { $set: { "offers.$.live_price_status": `unreadable: ${live.reason}`.slice(0, 120), reifen_com_price_checked_at: now } }
      );
    }
    return;
  }

  const diff = +(live.price - stored).toFixed(2);
  const jump = stored > 0 ? Math.abs(diff) / stored : 0;
  if (jump > OPTS.maxJump && !OPTS.force) {
    totals.suspicious++;
    console.log(`!! ${doc.ean}  stored ${stored}  live ${live.price}  (${Math.round(jump * 100)} % jump — not applied, use --force)  ${url}`);
    if (!OPTS.dryRun) {
      await LiveProduct.updateOne(
        { _id: doc._id, "offers.vendor": offer.vendor },
        { $set: { "offers.$.merchant_price": live.price, "offers.$.live_price_status": "suspicious jump", reifen_com_price_checked_at: now } }
      );
    }
    return;
  }

  const priceChanged = Math.abs(diff) >= 0.01;
  const stockChanged = live.inStock !== undefined && (offer.in_stock !== false) !== live.inStock;
  if (priceChanged) totals.changed++; else totals.same++;
  console.log(
    `${priceChanged ? "XX" : "OK"} ${doc.ean}  stored ${stored}  live ${live.price}` +
      (priceChanged ? `  (${diff > 0 ? "+" : ""}${diff})` : "") +
      (stockChanged ? `  stock → ${live.inStock ? "in stock" : "out of stock"}` : "") +
      `  [${live.source}]`
  );
  if (OPTS.dryRun) return;

  if (offer.price_source !== "reifen.com-live") offer.awin_price = stored || offer.awin_price;
  offer.price = live.price;
  offer.merchant_price = live.price;
  offer.merchant_price_checked_at = now;
  offer.price_mismatch = false;
  offer.price_source = "reifen.com-live";
  offer.live_price_checked_at = now;
  offer.live_price_status = `ok (${live.source})`;
  if (live.inStock !== undefined) offer.in_stock = live.inStock;

  const stats = computeOfferStats(dropOutOfStockWhenAlternatives(offers));
  const price_trend = nextPriceTrend(doc.price_trend, stats.cheapest_offer);

  // Only write if the AWIN import hasn't rewritten this product meanwhile.
  const res = await LiveProduct.updateOne(
    { _id: doc._id, import_hash: doc.import_hash ?? null },
    { $set: { ...stats, price_trend, reifen_com_price_checked_at: now, last_price_synced_at: now } }
  );
  if (!res.matchedCount) { totals.raced++; return; }
  if (priceChanged || stockChanged) {
    await recordPriceSnapshots([{ ean: doc.ean, offers: stats.offers, cheapest_offer: stats.cheapest_offer }]);
  }
}

/* ------------------------------ main loop ---------------------------- */
async function waitWhileImportRuns() {
  for (;;) {
    const lock = await getLockState().catch(() => ({ alive: false }));
    if (!lock.alive) return;
    console.log(`⏳ AWIN import running (${lock.progress}%) — waiting 60 s...`);
    await sleep(60000);
  }
}

export async function syncReifenComPrices() {
  const filter = { "offers.vendor": REIFEN_COM_VENDOR_REGEX };
  if (OPTS.slug) filter.slug = OPTS.slug;
  if (OPTS.ean) filter.ean = String(OPTS.ean).replace(/\D/g, "").replace(/^0+/, "");
  if (OPTS.staleHours > 0 && !OPTS.slug && !OPTS.ean) {
    const cutoff = new Date(Date.now() - OPTS.staleHours * 3600 * 1000);
    filter.$or = [
      { reifen_com_price_checked_at: { $exists: false } },
      { reifen_com_price_checked_at: { $lt: cutoff } },
    ];
  }

  const total = await LiveProduct.countDocuments(filter);
  const todo = OPTS.limit > 0 ? Math.min(OPTS.limit, total) : total;
  console.log(
    `🔎 reifen.com live price sync: ${todo} of ${total} product(s)` +
      `${OPTS.dryRun ? " (dry run — nothing is written)" : ""}${OPTS.browser ? " [browser fallback on]" : ""}`
  );

  const totals = { checked: 0, same: 0, changed: 0, unreadable: 0, suspicious: 0, noOffer: 0, noUrl: 0, raced: 0 };
  const projection = { ean: 1, slug: 1, offers: 1, price_trend: 1, import_hash: 1 };
  let lastId = null;

  while (totals.checked < todo) {
    await waitWhileImportRuns();
    const q = lastId ? { ...filter, _id: { $gt: lastId } } : filter;
    const batch = await LiveProduct.find(q, projection)
      .sort({ _id: 1 })
      .limit(Math.min(OPTS.batch, todo - totals.checked))
      .lean();
    if (!batch.length) break;

    for (const doc of batch) {
      lastId = doc._id;
      totals.checked++;
      try {
        await syncProduct(doc, totals);
      } catch (err) {
        totals.unreadable++;
        console.log(`❌ ${doc.ean}  ${err?.message || err}`);
      }
      if (totals.checked % 50 === 0) {
        console.log(`… ${totals.checked}/${todo}  changed ${totals.changed}  same ${totals.same}  unreadable ${totals.unreadable}`);
      }
      await sleep(OPTS.delayMs);
    }
  }

  await closeBrowser();
  console.log("\n==== reifen.com live price sync ====");
  console.log(totals);
  const readable = totals.same + totals.changed + totals.suspicious;
  if (readable) {
    console.log(`${Math.round(((totals.changed + totals.suspicious) / readable) * 100)} % of readable reifen.com prices differed from the stored (AWIN) price.`);
  }
  if (totals.unreadable && !readable) {
    console.log("No price could be read. reifen.com may be blocking this server — run again with --browser.");
  }
  return totals;
}

/* ------------------------------ CLI ---------------------------------- */
if (process.argv[1] && process.argv[1].endsWith("syncReifenComPrices.js")) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => syncReifenComPrices())
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error("❌ reifen.com sync failed:", err?.message || err);
      await closeBrowser();
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}
