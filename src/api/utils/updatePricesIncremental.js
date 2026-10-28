// version script 1.0.0  updatePricesIncremental.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import axios from "axios";
import csv from "csv-parser";
import AdmZip from "adm-zip";
import os from "os";
import { detectCsvSeparator, csvSeparatorFromFeedUrl } from "./awinCsv.js";
import Product from "../../models/product.js";
import ImportMeta from "../../models/ImportMeta.js";
import affiliateCloak from "./affiliateCloak.js";
import {
    pickRowPrice,
    parseInStock,
    computeOfferStats,
    dropOutOfStockWhenAlternatives,
    getFeedProductKey,
} from "./offerPricing.js";
import { hasAwinAffiliateLink } from "./offerUtils.js";
import { isReifenComOffer } from "./reifenCom.js";
import { nextPriceTrend, recordPriceSnapshots } from "./priceHistory.js";

dotenv.config();

const LiveProduct = mongoose.model("Product", Product.schema, "products");
 
/* ---------------- Config ---------------- */
const FEED_URL = process.env.AWIN_QUICK_PRICE_URL || process.env.AWIN_CSV_URL || "";         // optional (https://...)
const FEED_PATH = process.env.AWIN_QUICK_PRICE_PATH || "";        // optional (/path/to/awin.csv)
const GROUP_SIZE = Number(process.env.PRICE_GROUP_SIZE || 400);    // unique EANs per DB batch
const PRINT_EVERY = Number(process.env.PRICE_PRINT_EVERY || 200);  // products per progress line
const PRICE_EPS = Number(process.env.PRICE_EPS || 0.005);         // min delta to consider a change
const TIMEOUT_MS = Number(process.env.FEED_HTTP_TIMEOUT_MS || 180000); // ZIP download timeout
const LIVE_PRICE_TTL_MS = Number(process.env.REIFEN_LIVE_PRICE_TTL_HOURS || 26) * 3600 * 1000;

/* ---------------- Utils ---------------- */
function normalizeEAN(ean) {
    if (!ean) return "";
    return String(ean).trim().replace(/^0+/, "");
}

function nearlyEqual(a = 0, b = 0, eps = PRICE_EPS) {
    return Math.abs(Number(a) - Number(b)) < eps;
}

/* ---------------- CSV source ---------------- */
async function getCsvReadableStream() {
    if (FEED_URL) {
        const resp = await axios.get(FEED_URL, {
            responseType: "arraybuffer",
            timeout: TIMEOUT_MS,
            maxContentLength: Infinity,
        });
        const buffer = Buffer.from(resp.data);
        const looksZip = buffer.slice(0, 2).toString() === "PK";
        if (looksZip) {
            const zip = new AdmZip(buffer);
            const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith(".csv"));
            if (!csvEntry) throw new Error("CSV not found in AWIN ZIP");
            const tmpPath = path.join(os.tmpdir(), `awin-prices-${Date.now()}.csv`);
            fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
            const stream = fs.createReadStream(tmpPath);
            stream.on("close", () => {
                try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
            });
            return stream;
        }
        const tmpPath = path.join(os.tmpdir(), `awin-prices-${Date.now()}.csv`);
        fs.writeFileSync(tmpPath, buffer);
        return fs.createReadStream(tmpPath);
    }
    if (!FEED_PATH) throw new Error("No AWIN_CSV_URL or AWIN_QUICK_PRICE_PATH provided");
    return fs.createReadStream(path.resolve(FEED_PATH));
}

/* ---------------- Core: process groups ---------------- */
/** Best row per vendor for one EAN: in stock first, then lowest price. */
function bestRowPerVendor(rows) {
    const byVendor = new Map();
    for (const r of rows) {
        const price = pickRowPrice(r);
        if (!(price > 0) || !hasAwinAffiliateLink(r)) continue;
        const rec = {
            vendor_id: String(r.merchant_id || "").trim(),
            vendor: String(r.merchant_name || "").trim(),
            price,
            in_stock: parseInStock(r.in_stock),
            delivery_cost: r.delivery_cost,
            delivery_time: r.delivery_time,
            aw_product_id: r.aw_product_id,
            aw_deep_link: r.aw_deep_link,
            merchant_deep_link: r.merchant_deep_link,
        };
        const key = rec.vendor_id ? `id:${rec.vendor_id}` : `name:${rec.vendor.toLowerCase()}`;
        const prev = byVendor.get(key);
        const better =
            !prev ||
            (rec.in_stock && !prev.in_stock) ||
            (rec.in_stock === prev.in_stock && rec.price < prev.price);
        if (better) byVendor.set(key, rec);
    }
    return [...byVendor.values()];
}

async function processGroupBatch(eanToRowsMap, counters) {
    const eans = Array.from(eanToRowsMap.keys());
    if (!eans.length) return;

    const docs = await LiveProduct.find({ ean: { $in: eans } }, { ean: 1, offers: 1, price_trend: 1 }).lean();
    const dbByEan = new Map(docs.map(d => [normalizeEAN(d.ean), d]));
    const bulk = [];
    const touched = [];

    for (const ean of eans) {
        counters.processed++;
        const doc = dbByEan.get(ean);
        if (!doc) {
            counters.skipped++;
            continue; // new products are added by the full import only
        }

        const incoming = bestRowPerVendor(eanToRowsMap.get(ean) || []);
        const offers = Array.isArray(doc.offers) ? doc.offers.map(o => ({ ...o })) : [];
        const byVendorId = new Map(offers.map(o => [String(o.vendor_id || "").trim(), o]));
        const byVendorName = new Map(offers.map(o => [String(o.vendor || "").trim().toLowerCase(), o]));

        let changes = 0;
        for (const rec of incoming) {
            const target =
                (rec.vendor_id && byVendorId.get(rec.vendor_id)) ||
                byVendorName.get(rec.vendor.toLowerCase());
            if (!target) continue; // new vendors are added by the full import

            // A fresh reifen.com live price wins over the (older) AWIN feed price.
            const liveAt = target.live_price_checked_at ? new Date(target.live_price_checked_at).getTime() : 0;
            const keepLive =
                isReifenComOffer(target) &&
                target.price_source === "reifen.com-live" &&
                liveAt && Date.now() - liveAt <= LIVE_PRICE_TTL_MS;
            if (keepLive) {
                target.awin_price = rec.price;
            } else if (!nearlyEqual(Number(target.price) || 0, rec.price)) {
                target.price = rec.price;
                target.price_source = "awin";
                changes++;
            }
            if (!keepLive && (target.in_stock !== false) !== rec.in_stock) {
                target.in_stock = rec.in_stock;
                changes++;
            }
            // Keep the AWIN link pointing at the product this price belongs to.
            if (rec.aw_deep_link && rec.aw_deep_link !== target.original_affiliate_url) {
                target.original_affiliate_url = rec.aw_deep_link;
                target.affiliate_product_cloak_url = affiliateCloak.encodeAffiliateUrl(rec.aw_deep_link);
                target.aw_product_id = rec.aw_product_id || target.aw_product_id;
                target.aw_deep_link = `/go/${target.aw_product_id}?from=reifendb`;
                changes++;
            }
            if (rec.merchant_deep_link) target.merchant_deep_link = rec.merchant_deep_link;
            if (rec.delivery_cost !== undefined) target.delivery_cost = rec.delivery_cost;
            if (rec.delivery_time !== undefined) target.delivery_time = rec.delivery_time;
        }

        if (!changes) {
            counters.skipped++;
            continue;
        }

        const kept = dropOutOfStockWhenAlternatives(offers);
        const stats = computeOfferStats(kept);
        const price_trend = nextPriceTrend(doc.price_trend, stats.cheapest_offer);
        touched.push({ ean: doc.ean, offers: stats.offers, cheapest_offer: stats.cheapest_offer });
        bulk.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { ...stats, price_trend, last_price_synced_at: new Date() } } } });

        counters.updated++;
        counters.offersUpdated += changes;
        if (counters.processed % PRINT_EVERY === 0) {
            console.log(
                `Updated: ${counters.updated}  Skipped: ${counters.skipped}  OffersUpdated: ${counters.offersUpdated}  Left: ${Math.max(0, counters.seenProducts - counters.processed)}`
            );
        }
    }

    if (bulk.length) await LiveProduct.bulkWrite(bulk, { ordered: false });
    if (touched.length) await recordPriceSnapshots(touched);
}

/* ---------------- Main ---------------- */
async function main() {
    try {
        const meta = await ImportMeta.findOne({ source: "AWIN" }).lean();
        if (meta?.isRunning) {
            console.log("⏭️  Skipping quick price update: full AWIN import is running.");
            process.exit(0);
        }

        console.log("⚡ Starting incremental price refresh...");
        const stream = await getCsvReadableStream();
        const csvSeparator =
            csvSeparatorFromFeedUrl(process.env.AWIN_CSV_URL || FEED_URL) ||
            (FEED_PATH ? detectCsvSeparator(FEED_PATH) : ",");

        const counters = { rows: 0, seenProducts: 0, processed: 0, updated: 0, skipped: 0, offersUpdated: 0 };

        // Read the whole feed first: rows for one EAN can be anywhere in the file,
        // and flushing mid-stream raced with parsing and split vendors across writes.
        const eanMap = new Map();
        await new Promise((resolve, reject) => {
            stream
                .pipe(csv({ separator: csvSeparator }))
                .on("data", (row) => {
                    counters.rows++;
                    const ean = getFeedProductKey(row); // same key as the full import
                    if (!ean) return;
                    if (!eanMap.has(ean)) {
                        eanMap.set(ean, []);
                        counters.seenProducts++;
                    }
                    eanMap.get(ean).push({
                        aw_product_id: row["aw_product_id"],
                        aw_deep_link: row["aw_deep_link"],
                        merchant_deep_link: row["merchant_deep_link"],
                        merchant_id: row["merchant_id"],
                        merchant_name: row["merchant_name"],
                        search_price: row["search_price"],
                        display_price: row["display_price"],
                        store_price: row["store_price"],
                        in_stock: row["in_stock"],
                        delivery_cost: row["delivery_cost"],
                        delivery_time: row["delivery_time"],
                    });
                })
                .on("end", resolve)
                .on("error", reject);
        });

        const keys = [...eanMap.keys()];
        for (let i = 0; i < keys.length; i += GROUP_SIZE) {
            const group = new Map(keys.slice(i, i + GROUP_SIZE).map(k => [k, eanMap.get(k)]));
            await processGroupBatch(group, counters);
        }

        console.log(
            `✅ Done. Updated: ${counters.updated}  Skipped: ${counters.skipped}  OffersUpdated: ${counters.offersUpdated}  ProductsProcessed: ${counters.processed}  RowsRead: ${counters.rows}`
        );
    } catch (err) {
        console.error("❌ Fatal error:", err?.message || err);
        process.exit(1);
    }
}

/* ---------------- Boot ---------------- */
if (process.argv[1] && process.argv[1].endsWith("updatePricesIncremental.js")) {
    // Connect, run, exit
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error("Missing MONGODB_URI");
        process.exit(1);
    }
    mongoose
        .connect(uri)
        .then(() => main())
        .then(() => mongoose.disconnect())
        .catch(async (e) => {
            console.error("❌", e?.message || e);
            try { await mongoose.disconnect(); } catch { }
            process.exit(1);
        });
}

export default main;
