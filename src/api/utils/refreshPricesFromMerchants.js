// version script 1.0.0  refreshPricesFromMerchants.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import pLimit from "p-limit";
import Product from "../../models/product.js";
import { computeOfferStats } from "./offerPricing.js";
import { isReifenComOffer } from "./reifenCom.js";
import { applyShopPrice } from "./merchantLivePrice.js";
import { isGigaVendor } from "./gigaShop.js";
import { parseReifenComPage } from "./reifenComLivePrice.js";

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
// Show the price from the shop's own page instead of the (often older) AWIN
// feed price. Default ON: visitors must see the price they will pay at the shop.
// PRICE_REFRESH_APPLY=false → verify only (record merchant_price, change nothing).
const APPLY = String(process.env.PRICE_REFRESH_APPLY || "true").toLowerCase() === "true";
// Flag offers whose merchant price differs from AWIN by more than this
const MISMATCH_RATIO = Number(process.env.PRICE_MISMATCH_RATIO || 0.03);
// Never apply a merchant price that differs by more than this (likely a wrong
// scrape, e.g. an accessory at 10 € on a 55 € tyre). Real shop moves are often
// larger than a few percent — the Atlas example went from 44 € in the feed to
// 53 € on reifen.de — so the default allows up to 40 %.
const MAX_APPLY_RATIO = Number(process.env.PRICE_REFRESH_MAX_APPLY_RATIO || 0.4);

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
    // Same reader as the reifen.com sync: JSON-LD, microdata (reifen.de),
    // OpenGraph, and the reifen.com product-detail price. Returns undefined
    // when the page does not name one selling price.
    const parsed = parseReifenComPage(html);
    if (!(parsed.price > 0)) return undefined;
    return parsed;
}

/** Selling price of the main product, or undefined when the page is ambiguous. */
export function mainProductPrice(html) {
    const parsed = parseReifenComPage(html);
    return parsed.price > 0 ? parsed.price : undefined;
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

function argValue(flag) {
    const i = process.argv.indexOf(flag);
    return i > -1 ? process.argv[i + 1] : "";
}
const ONLY_SLUG = argValue("--slug");
const ONLY_EAN = argValue("--ean");
// The full-catalog script sets this so reifen.com is updated in the same pass.
const INCLUDE_REIFEN = String(process.env.PRICE_REFRESH_INCLUDE_REIFEN || "").toLowerCase() === "true";

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
    import_hash: 1,
};

function candidateFilter() {
    const filter = { ...baseFilter };
    if (ONLY_SLUG) filter.slug = ONLY_SLUG;
    if (ONLY_EAN) filter.ean = ONLY_EAN;
    return filter;
}

async function countCandidates() {
    return LiveProduct.countDocuments(candidateFilter());
}

async function fetchBatch(skip, limit) {
    return LiveProduct.find(candidateFilter(), projection)
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
    let stockChanges = 0;
    let checked = 0;

    // Read the selling price on each shop's own page and show that price.
    // The AWIN feed often lags the shop (reifen.de was 44,05 € in the feed
    // and 53,08 € on the page). PRICE_REFRESH_APPLY=false only records it.
    await Promise.all(
        offers.map((offer) =>
            limitOffer(async () => {
                // Skipped unless this is the full-catalog run (updateAllShopPrices.js).
                if (!INCLUDE_REIFEN && isReifenComOffer(offer)) return;
                // giga-reifen.de answers 403. Prices for that shop come from
                // the German AWIN feed: npm run giga:sync
                if (isGigaVendor(offer)) return;
                const url = String(offer.merchant_deep_link || "").trim();
                if (!/^https?:\/\//i.test(url)) return;

                const live = await fetchLivePrice(url);
                if (!(live?.price > 0)) return;
                checked++;

                if (live.inStock !== undefined && (offer.in_stock !== false) !== live.inStock) {
                    offer.in_stock = live.inStock;
                    stockChanges++;
                }
                if (applyShopPrice(offer, live.price, { apply: APPLY, mismatchRatio: MISMATCH_RATIO, maxApplyRatio: MAX_APPLY_RATIO })) priceChanges++;
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

    // Only write if the AWIN import has not rewritten this product while we
    // were reading the shop pages (it would otherwise be reverted).
    const res = await LiveProduct.updateOne({ _id: prod._id, import_hash: prod.import_hash ?? null }, { $set: update });
    if (!res.matchedCount) return { changed: false, raced: true };
    return { changed: true, priceChanges, stockChanges, update, dryRun: false };
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
        let pricesChanged = 0;
        let raced = 0;

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
                pricesChanged += r.priceChanges || 0;
                if (r.raced) raced++;

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
            `\n🎉 Done. Checked products: ${updated}, shop prices applied/changed: ${pricesChanged}, skipped: ${skipped}, ` +
            `rewritten by import meanwhile: ${raced}, total: ${total}${DRY_RUN ? " (dry-run)" : ""}${APPLY ? "" : " (verify only)"}`
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
