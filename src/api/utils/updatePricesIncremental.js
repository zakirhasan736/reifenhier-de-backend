// version script 1.0.0  updatePricesIncremental.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import axios from "axios";
import csv from "csv-parser";
import Product from "../../models/product.js";
import ImportMeta from "../../models/ImportMeta.js";
import affiliateCloak from "./affiliateCloak.js";

dotenv.config();

const LiveProduct = mongoose.model("Product", Product.schema, "products");
 
/* ---------------- Config ---------------- */
const FEED_URL = process.env.AWIN_QUICK_PRICE_URL || "";         // optional (https://...)
const FEED_PATH = process.env.AWIN_QUICK_PRICE_PATH || "";        // optional (/path/to/awin.csv)
const GROUP_SIZE = Number(process.env.PRICE_GROUP_SIZE || 400);    // unique EANs per DB batch
const PRINT_EVERY = Number(process.env.PRICE_PRINT_EVERY || 200);  // products per progress line
const PRICE_EPS = Number(process.env.PRICE_EPS || 0.005);         // min delta to consider a change
const TIMEOUT_MS = Number(process.env.FEED_HTTP_TIMEOUT_MS || 60000); // CSV download timeout

/* ---------------- Utils ---------------- */
function normalizeEAN(ean) {
    if (!ean) return "";
    return String(ean).trim().replace(/^0+/, "");
}

function parseSafeNumber(val) {
    if (val === null || val === undefined || val === "") return undefined;
    const n = parseFloat(String(val).replace(",", "."));
    return Number.isFinite(n) ? n : undefined;
}

function recomputeOfferSavings(offers) {
    const prices = offers.map(o => Number(o.price)).filter(p => p > 0 && Number.isFinite(p));
    const max = prices.length ? Math.max(...prices) : 0;

    if (!max) {
        for (const o of offers) {
            o.savings_amount = 0;
            o.savings_percent = "0%";
        }
        return;
    }

    for (const o of offers) {
        const p = Number(o.price) || 0;
        const savings_amount = Math.max(0, max - p);
        o.savings_amount = +savings_amount.toFixed(2);
        o.savings_percent = savings_amount > 0 ? `-${Math.round((savings_amount / max) * 100)}%` : "0%";
    }
}

function recomputeProductStats(productDoc) {
    const offers = Array.isArray(productDoc.offers) ? productDoc.offers : [];
    const numeric = offers.map(o => Number(o.price)).filter(p => p > 0 && Number.isFinite(p));

    const stats = {
        cheapest_offer: 0,
        expensive_offer: 0,
        search_price: 0,
        savings_amount: 0,
        savings_percent: "0%",
        cheapest_vendor: null,
        total_offers: offers.length,
        cheapest_price_display: undefined,
        expensive_price_display: undefined,
        savings_badge: undefined,
    };

    if (!numeric.length) return stats;

    const cheapest = Math.min(...numeric);
    const expensive = Math.max(...numeric);
    const savings_amount = +(Math.max(0, expensive - cheapest)).toFixed(2);
    const savings_percent = savings_amount > 0 ? `-${Math.round((savings_amount / expensive) * 100)}%` : "0%";

    const cheapestOffer = offers.find(o => Number(o.price) === cheapest) || null;

    stats.cheapest_offer = cheapest;
    stats.expensive_offer = expensive;
    stats.search_price = cheapest;
    stats.savings_amount = savings_amount;
    stats.savings_percent = savings_percent;
    stats.cheapest_vendor = cheapestOffer
        ? {
            aw_product_id: cheapestOffer.aw_product_id,
            vendor_id: cheapestOffer.vendor_id,
            vendor: cheapestOffer.vendor,
            vendor_logo: cheapestOffer.vendor_logo,
            aw_deep_link: cheapestOffer.aw_deep_link,
            payment_icons: cheapestOffer.payment_icons,
            delivery_cost: cheapestOffer.delivery_cost,
            original_affiliate_url: cheapestOffer.original_affiliate_url,
            affiliate_product_cloak_url: cheapestOffer.original_affiliate_url
                ? affiliateCloak.encodeAffiliateUrl(cheapestOffer.original_affiliate_url)
                : null,
        }
        : null;

    // Presentational fields
    stats.cheapest_price_display = cheapest ? `${cheapest.toFixed(2).replace(".", ",")} €` : undefined;
    stats.expensive_price_display = expensive ? `${expensive.toFixed(2).replace(".", ",")} €` : undefined;
    stats.savings_badge = savings_amount > 0 ? `Spare ${savings_percent}` : undefined;

    return stats;
}

function nearlyEqual(a = 0, b = 0, eps = PRICE_EPS) {
    return Math.abs(Number(a) - Number(b)) < eps;
}

/* ---------------- CSV source ---------------- */
async function getCsvReadableStream() {
    if (FEED_URL) {
        const resp = await axios.get(FEED_URL, { responseType: "stream", timeout: TIMEOUT_MS, maxContentLength: Infinity });
        return resp.data; // readable stream
    }
    if (!FEED_PATH) throw new Error("No AWIN_QUICK_PRICE_URL or AWIN_QUICK_PRICE_PATH provided");
    return fs.createReadStream(path.resolve(FEED_PATH));
}

/* ---------------- Core: process groups ---------------- */
async function processGroupBatch(eanToRowsMap, counters) {
    const eans = Array.from(eanToRowsMap.keys());
    if (!eans.length) return;

    // Fetch products in one query
    const docs = await LiveProduct.find(
        { ean: { $in: eans } },
        { ean: 1, offers: 1 } // minimal fields needed
    ).lean();

    const dbByEan = new Map(docs.map(d => [normalizeEAN(d.ean), d]));
    const bulk = [];

    for (const ean of eans) {
        const doc = dbByEan.get(ean);
        if (!doc) {
            counters.skipped++;
            counters.processed++;
            continue; // product not in DB → skip (this script does not insert)
        }

        const rows = eanToRowsMap.get(ean) || [];
        // Build a quick view of new vendor prices by vendor_id (preferred) and fallback by merchant_name
        const incoming = rows.map(r => ({
            vendor_id: String(r.merchant_id || r.vendor_id || "").trim(),
            vendor: String(r.merchant_name || r.vendor || "").trim(),
            price: parseSafeNumber(r.search_price),
            delivery_cost: r.delivery_cost,
            delivery_time: r.delivery_time,
            aw_product_id: r.aw_product_id,
        })).filter(x => x.price && x.price > 0);

        // Map existing offers
        const offers = Array.isArray(doc.offers) ? [...doc.offers] : [];
        const byVendorId = new Map(offers.map(o => [String(o.vendor_id || "").trim(), o]));
        const byVendorName = new Map(offers.map(o => [String(o.vendor || "").trim().toLowerCase(), o]));

        let offerPriceChanges = 0;

        // Update only vendors that already exist on this product
        for (const rec of incoming) {
            let target = null;
            if (rec.vendor_id && byVendorId.has(rec.vendor_id)) {
                target = byVendorId.get(rec.vendor_id);
            } else if (rec.vendor && byVendorName.has(rec.vendor.toLowerCase())) {
                target = byVendorName.get(rec.vendor.toLowerCase());
            }
            if (!target) continue; // ignore new vendors in quick pass

            const oldPrice = Number(target.price) || 0;
            const newPrice = Number(rec.price) || 0;

            if (!nearlyEqual(oldPrice, newPrice)) {
                target.price = newPrice;
                offerPriceChanges++;
            }

            // Optionally keep delivery info fresh
            if (rec.delivery_cost !== undefined) target.delivery_cost = rec.delivery_cost;
            if (rec.delivery_time !== undefined) target.delivery_time = rec.delivery_time;
        }

        if (offerPriceChanges === 0) {
            counters.skipped++;
            counters.processed++;
            continue;
        }

        // Recompute savings at offer level, then recompute product stats
        recomputeOfferSavings(offers);
        const stats = recomputeProductStats({ offers });

        // Prepare bulk update (set offers + top-level price metrics)
        bulk.push({
            updateOne: {
                filter: { _id: doc._id },
                update: {
                    $set: {
                        offers,
                        cheapest_offer: stats.cheapest_offer,
                        expensive_offer: stats.expensive_offer,
                        search_price: stats.search_price,
                        savings_amount: stats.savings_amount,
                        savings_percent: stats.savings_percent,
                        cheapest_vendor: stats.cheapest_vendor,
                        total_offers: stats.total_offers,
                        cheapest_price_display: stats.cheapest_price_display,
                        expensive_price_display: stats.expensive_price_display,
                        savings_badge: stats.savings_badge,
                    },
                },
            },
        });

        counters.updated++;
        counters.offersUpdated += offerPriceChanges;
        counters.processed++;

        if (counters.processed % PRINT_EVERY === 0) {
            const left = Math.max(0, counters.seenProducts - counters.processed);
            console.log(
                `Updated: ${counters.updated}  Skipped: ${counters.skipped}  OffersUpdated: ${counters.offersUpdated}  Left: ${left}`
            );
        }
    }

    if (bulk.length) await LiveProduct.bulkWrite(bulk, { ordered: false });
}

/* ---------------- Main ---------------- */
async function main() {
    try {
        // Do not run if the full AWIN import is currently running
        const meta = await ImportMeta.findOne({ source: "AWIN" }).lean();
        if (meta?.isRunning) {
            console.log("⏭️  Skipping quick price update: full AWIN import is running.");
            process.exit(0);
        }

        console.log("⚡ Starting incremental price refresh...");
        const stream = await getCsvReadableStream();

        const counters = {
            rows: 0,
            seenProducts: 0, // unique EANs encountered
            processed: 0,    // unique EANs flushed/processed
            updated: 0,
            skipped: 0,
            offersUpdated: 0,
        };

        // EAN -> array of minimal rows
        const eanMap = new Map();

        const flushIfNeeded = async (force = false) => {
            if (!force && eanMap.size < GROUP_SIZE) return;
            const toFlush = new Map(eanMap);
            eanMap.clear();
            await processGroupBatch(toFlush, counters);
        };

        await new Promise((resolve, reject) => {
            stream
                .pipe(csv({ separator: ";" }))
                .on("data", (row) => {
                    counters.rows++;

                    // Only the minimal fields needed for price refresh
                    const ean = normalizeEAN(row["ean"]);
                    if (!ean) return;

                    // track unique EANs seen so far
                    if (!eanMap.has(ean)) counters.seenProducts++;

                    const r = {
                        ean,
                        aw_product_id: row["aw_product_id"],
                        merchant_id: row["merchant_id"],
                        merchant_name: row["merchant_name"],
                        search_price: row["search_price"],
                        delivery_cost: row["delivery_cost"],
                        delivery_time: row["delivery_time"],
                    };

                    const arr = eanMap.get(ean) || [];
                    arr.push(r);
                    eanMap.set(ean, arr);

                    if (eanMap.size >= GROUP_SIZE) {
                        // backpressure: pause stream, flush, then resume
                        stream.pause();
                        flushIfNeeded(true)
                            .then(() => stream.resume())
                            .catch(reject);
                    }
                })
                .on("end", async () => {
                    try {
                        await flushIfNeeded(true);
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                })
                .on("error", reject);
        });

        // Final print
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
