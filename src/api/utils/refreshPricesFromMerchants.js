// version script 1.0.0  refreshPricesFromMerchants.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import pLimit from "p-limit";
import Product from "../../models/product.js";
import { computeOfferStats } from "./offerPricing.js";

dotenv.config();

/* ----------------------------- Tuning / Env ----------------------------- */
// How many products to load per batch from Mongo
const BATCH_SIZE = Number(process.env.PRICE_REFRESH_BATCH || 200);
// Parallel products processed at once
const PRODUCT_CONCURRENCY = Number(process.env.PRICE_REFRESH_PRODUCT_CONCURRENCY || 6);
// Parallel fetches per product (offers)
const OFFER_CONCURRENCY = Number(process.env.PRICE_REFRESH_OFFER_CONCURRENCY || 4);
// HTTP timeouts & size
const HTTP_TIMEOUT_MS = Number(process.env.PRICE_REFRESH_TIMEOUT_MS || 15000);
const MAX_HTML_BYTES = Number(process.env.PRICE_REFRESH_MAX_HTML_BYTES || 2 * 1024 * 1024);
// If true, do not write to DB, only log what would change
const DRY_RUN = String(process.env.PRICE_REFRESH_DRY_RUN || "false").toLowerCase() === "true";
// Overwrite AWIN prices with merchant-page prices? (default: no, verify only)
const APPLY = String(process.env.PRICE_REFRESH_APPLY || "false").toLowerCase() === "true";
// Flag offers whose merchant price differs from AWIN by more than this
const MISMATCH_RATIO = Number(process.env.PRICE_MISMATCH_RATIO || 0.03);
// Never apply a merchant price that differs by more than this (likely wrong scrape)
const MAX_APPLY_RATIO = Number(process.env.PRICE_REFRESH_MAX_APPLY_RATIO || 0.25);

/* ------------------------------- Utilities ------------------------------ */
function parseSafeNumber(val) {
    if (val === null || val === undefined) return undefined;
    const s = String(val).trim().replace(/\s+/g, " ");
    if (!s) return undefined;
    // normalize common formats: "1.234,56" or "1,234.56" or "1234,56"
    const dot = (s.match(/\./g) || []).length;
    const comma = (s.match(/,/g) || []).length;

    let normalized = s;
    // If both separators exist, assume the last one is decimal
    if (dot && comma) {
        if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
            // dots thousand, comma decimal
            normalized = s.replace(/\./g, "").replace(",", ".");
        } else {
            // commas thousand, dot decimal
            normalized = s.replace(/,/g, "");
        }
    } else if (comma && !dot) {
        // only comma present -> decimal comma
        normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
        // only dot or none -> already decimal dot or integer
        normalized = s.replace(/,/g, "");
    }

    const num = Number(normalized.replace(/[^\d.]/g, ""));
    return isFinite(num) ? num : undefined;
}

/* ----------------------------- Price scraping --------------------------- */
/**
 * Read the price of THE product on a merchant page.
 *
 * Previously this took the LOWEST number anywhere on the page (cross-sells,
 * shipping "4,99", highPrice/lowPrice, data-price of other sizes, even a
 * regex over the whole HTML) and wrote it over the AWIN price — so the site
 * showed prices the shop never charged. Now only an unambiguous main-product
 * price is accepted; anything else returns undefined (= "couldn't verify").
 */
async function fetchLivePrice(url) {
    const html = await fetchHtml(url);
    if (!html) return undefined;
    return mainProductPrice(html);
}

export function mainProductPrice(html) {
    // 1) JSON-LD: exactly one Product, its own Offer(s), one distinct price
    const products = [];
    const rx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = rx.exec(html))) {
        try {
            const stack = [JSON.parse(m[1].trim())];
            while (stack.length) {
                const n = stack.pop();
                if (!n || typeof n !== "object") continue;
                if (Array.isArray(n)) { stack.push(...n); continue; }
                if (n["@graph"]) stack.push(n["@graph"]);
                const types = [].concat(n["@type"] || []).map(t => String(t).toLowerCase());
                if (types.includes("product")) products.push(n);
            }
        } catch { /* invalid JSON-LD */ }
    }
    if (products.length === 1) {
        const prices = new Set();
        for (const o of [].concat(products[0].offers || [])) {
            if (!o) continue;
            const t = String(o["@type"] || "").toLowerCase();
            const cur = String(o.priceCurrency || "EUR").toUpperCase();
            if (cur !== "EUR") continue;
            if (t === "aggregateoffer") continue; // marketplace range, not a price
            const p = parseSafeNumber(o.price ?? o.priceSpecification?.price);
            if (p > 0) prices.add(+p.toFixed(2));
        }
        if (prices.size === 1) return [...prices][0];
        if (prices.size > 1) return undefined;
    }

    // 2) OpenGraph product price (one per page by definition)
    const og = [...html.matchAll(/<meta[^>]+property=["'](?:product|og):price:amount["'][^>]*content=["']([^"']+)["']/gi)]
        .map(x => parseSafeNumber(x[1]))
        .filter(p => p > 0);
    if (og.length && new Set(og).size === 1) return og[0];

    return undefined;
}

async function fetchHtml(url) {
    try {
        const { data } = await axios.get(url, {
            timeout: HTTP_TIMEOUT_MS,
            maxContentLength: MAX_HTML_BYTES,
            headers: {
                // basic desktop UA to avoid some blocks
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            validateStatus: s => s >= 200 && s < 400,
        });
        if (typeof data !== "string") return undefined;
        return data;
    } catch {
        return undefined;
    }
}


/* --------------------------- MongoDB plumbing --------------------------- */
const LiveProduct = mongoose.model("Product", Product.schema, "products");

const baseFilter = {
    $or: [
        { merchant_deep_link: { $type: "string", $regex: /^https?:\/\//i } },
        {
            offers: {
                $elemMatch: {
                    merchant_deep_link: { $type: "string", $regex: /^https?:\/\//i },
                },
            },
        },
    ],
};

const projection = {
    _id: 1,
    ean: 1,
    product_name: 1,
    product_url: 1,
    offers: 1,
    // metrics we will recompute
    cheapest_offer: 1,
    expensive_offer: 1,
    savings_amount: 1,
    savings_percent: 1,
    search_price: 1,
    cheapest_price_display: 1,
    expensive_price_display: 1,
    savings_badge: 1,
    offer_count_display: 1,
    cheapest_vendor: 1,
};

async function countCandidates() {
    return LiveProduct.countDocuments(baseFilter);
}

async function fetchBatch(skip, limit) {
    return LiveProduct.find(baseFilter, projection)
        .sort({ _id: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
}

/* ------------------------------- Main flow ------------------------------ */
async function processProduct(prod) {
    if (!Array.isArray(prod.offers) || prod.offers.length === 0) {
        return { changed: false };
    }

    const offers = prod.offers.map(o => ({ ...o })); // shallow clone
    const limitOffer = pLimit(OFFER_CONCURRENCY);
    let priceChanges = 0;
    let checked = 0;

    // Verify each vendor page against the AWIN price. The AWIN feed is the
    // price AWIN and the shop agree on, so by default we only RECORD the
    // merchant price; PRICE_REFRESH_APPLY=true lets small, plausible
    // differences (feed lag) update the shown price.
    await Promise.all(
        offers.map((offer) =>
            limitOffer(async () => {
                const url = String(offer.merchant_deep_link || "").trim();
                if (!/^https?:\/\//i.test(url)) return;

                const livePrice = await fetchLivePrice(url);
                if (!(livePrice > 0)) return;
                checked++;

                const feed = Number(offer.price) || 0;
                const diffRatio = feed > 0 ? Math.abs(livePrice - feed) / feed : 1;
                offer.merchant_price = livePrice;
                offer.merchant_price_checked_at = new Date();
                offer.price_mismatch = diffRatio > MISMATCH_RATIO;

                if (APPLY && diffRatio > 0 && diffRatio <= MAX_APPLY_RATIO && Math.abs(livePrice - feed) >= 0.01) {
                    offer.price = livePrice;
                    offer.price_mismatch = false;
                    priceChanges++;
                }
            })
        )
    );

    if (!checked) return { changed: false };

    const derived = computeOfferStats(offers);
    const update = {
        ...derived,
        last_price_refreshed_at: new Date(),
    };


    if (DRY_RUN) {
        return { changed: true, update, dryRun: true };
    }

    await LiveProduct.updateOne({ _id: prod._id }, { $set: update });
    return { changed: true, update, dryRun: false };
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const total = await countCandidates();
        console.log(`\n🔎 Products with merchant links: ${total}`);

        if (!total) {
            console.log("✅ Nothing to refresh.");
            await mongoose.disconnect();
            return;
        }

        let processed = 0;
        let updated = 0;
        let skipped = 0;

        for (let skip = 0; skip < total; skip += BATCH_SIZE) {
            const batch = await fetchBatch(skip, BATCH_SIZE);
            const limitProd = pLimit(PRODUCT_CONCURRENCY);

            const results = await Promise.all(
                batch.map(prod =>
                    limitProd(async () => {
                        const r = await processProduct(prod);
                        return r;
                    })
                )
            );

            for (const r of results) {
                processed++;
                if (r.changed) updated++;
                else skipped++;

                if (processed % 50 === 0 || processed === total) {
                    const left = Math.max(0, total - processed);
                    process.stdout.write(
                        `\rProgress ${processed}/${total}  |  Updated: ${updated}  Skipped: ${skipped}  Left: ${left}`
                    );
                }
            }
        }

        process.stdout.write("\n");
        console.log(
            `\n🎉 Done. Updated: ${updated}, Skipped: ${skipped}, Total: ${total}${DRY_RUN ? " (dry-run)" : ""}`
        );

        await mongoose.disconnect();
    } catch (err) {
        console.error("\n❌ Fatal error:", err?.message || err);
        process.exit(1);
    }
}

if (process.argv[1] && process.argv[1].endsWith("refreshPricesFromMerchants.js")) {
    main();
}
