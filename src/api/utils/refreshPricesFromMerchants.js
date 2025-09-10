// version script 1.0.0  refreshPricesFromMerchants.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import pLimit from "p-limit";
import Product from "../../models/product.js";

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

function priceToDisplay(num) {
    if (typeof num !== "number" || !isFinite(num) || num <= 0) return undefined;
    return `${num.toFixed(2).replace(".", ",")} €`;
}

function computeDerivedFromOffers(offers = []) {
    const prices = offers
        .map(o => (typeof o.price === "number" && o.price > 0 ? o.price : 0))
        .filter(p => p > 0);

    const cheapest_offer = prices.length ? Math.min(...prices) : 0;
    const expensive_offer = prices.length ? Math.max(...prices) : 0;
    const savings_amount =
        expensive_offer > cheapest_offer ? +(expensive_offer - cheapest_offer).toFixed(2) : 0;
    const savings_percent =
        expensive_offer > cheapest_offer
            ? `-${Math.round(((expensive_offer - cheapest_offer) / expensive_offer) * 100)}%`
            : "0%";

    const cheapestVendorOffer =
        offers.find(o => typeof o.price === "number" && o.price === cheapest_offer) || null;

    const cheapest_vendor = cheapestVendorOffer
        ? {
            aw_product_id: cheapestVendorOffer.aw_product_id,
            vendor_id: cheapestVendorOffer.vendor_id,
            vendor: cheapestVendorOffer.vendor,
            vendor_logo: cheapestVendorOffer.vendor_logo,
            aw_deep_link: cheapestVendorOffer.aw_deep_link,
            payment_icons: cheapestVendorOffer.payment_icons,
            delivery_cost: cheapestVendorOffer.delivery_cost,
            original_affiliate_url: cheapestVendorOffer.original_affiliate_url,
            affiliate_product_cloak_url: cheapestVendorOffer.affiliate_product_cloak_url || null,
        }
        : null;

    return {
        cheapest_offer,
        expensive_offer,
        savings_amount,
        savings_percent,
        search_price: cheapest_offer,
        cheapest_price_display: priceToDisplay(cheapest_offer),
        expensive_price_display: priceToDisplay(expensive_offer),
        savings_badge: savings_amount > 0 ? `Spare ${savings_percent}` : undefined,
        offer_count_display: offers.length > 1 ? `${offers.length} Angebote` : "1 Angebot",
        cheapest_vendor,
    };
}

/* ----------------------------- Price scraping --------------------------- */
/**
 * Try multiple strategies (JSON-LD first, then microdata/meta, then regex fallback).
 * Returns a number (EUR) or undefined if not found.
 */
async function fetchLivePrice(url) {
    const html = await fetchHtml(url);
    if (!html) return undefined;

    // 1) JSON-LD (Product → offers → price, or AggregateOffer → lowPrice)
    try {
        const ldPrices = extractPricesFromJsonLd(html);
        const num = pickBestPrice(ldPrices);
        if (isFinite(num)) return num;
    } catch { }

    // 2) Microdata/meta tags (itemprop="price", meta price, og/twitter tags)
    try {
        const metaPrices = extractPricesFromMeta(html);
        const num = pickBestPrice(metaPrices);
        if (isFinite(num)) return num;
    } catch { }

    // 3) Regex fallback (may be noisy; take **smallest valid** > 0)
    const rxPrices = extractPricesViaRegex(html);
    const num = pickBestPrice(rxPrices);
    if (isFinite(num)) return num;

    return undefined;
}

function pickBestPrice(list) {
    const nums = (list || []).map(parseSafeNumber).filter(p => typeof p === "number" && p > 0);
    if (!nums.length) return undefined;
    // prefer the **lowest** price found on the page (common for PDPs)
    return Math.min(...nums);
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

function extractPricesFromJsonLd(html) {
    const prices = [];
    const scriptRx =
        /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = scriptRx.exec(html))) {
        const raw = m[1];
        try {
            const json = JSON.parse(raw.trim());
            scanJsonLd(json, prices);
        } catch {
            // Some sites embed invalid JSON-LD; ignore
        }
    }
    return prices;
}

function scanJsonLd(node, prices) {
    if (!node) return;
    if (Array.isArray(node)) {
        node.forEach(n => scanJsonLd(n, prices));
        return;
    }
    if (typeof node === "object") {
        // Offer / AggregateOffer
        if (
            (node["@type"] === "Offer" || node["@type"] === "AggregateOffer") &&
            (node.price || node.lowPrice || node.highPrice)
        ) {
            if (node.price) prices.push(String(node.price));
            if (node.lowPrice) prices.push(String(node.lowPrice));
            if (node.highPrice) prices.push(String(node.highPrice));
        }
        // Product → offers
        if (node["@type"] === "Product" && node.offers) {
            scanJsonLd(node.offers, prices);
        }
        // Traverse generically
        for (const k of Object.keys(node)) {
            if (k === "price" || k === "lowPrice" || k === "highPrice") {
                prices.push(String(node[k]));
            } else {
                scanJsonLd(node[k], prices);
            }
        }
    }
}

function extractPricesFromMeta(html) {
    const prices = [];
    // itemprop="price" content="..."
    const itempropRx = /itemprop=["']price["'][^>]*content=["']([^"']+)["']/gi;
    let m;
    while ((m = itempropRx.exec(html))) prices.push(m[1]);

    // meta property="product:price:amount" content="..."
    const ogPriceRx =
        /<meta[^>]+property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/gi;
    while ((m = ogPriceRx.exec(html))) prices.push(m[1]);

    // meta name="twitter:data1" content="€ 123,45"  (rare but seen)
    const twPriceRx =
        /<meta[^>]+name=["']twitter:data1["'][^>]*content=["']([^"']+)["']/gi;
    while ((m = twPriceRx.exec(html))) prices.push(m[1]);

    // data-price="..."
    const dataPriceRx = /data-price=["']([^"']+)["']/gi;
    while ((m = dataPriceRx.exec(html))) prices.push(m[1]);

    return prices;
}

function extractPricesViaRegex(html) {
    const prices = [];
    // Look for numbers that look like prices with 2 decimals, allow thousands sep
    const rx =
        /(?:^|[^\d])(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2}))(?:[^\d]|$)/g;
    let m;
    while ((m = rx.exec(html))) prices.push(m[1]);
    return prices;
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

    // Get live price for each offer that has a merchant_deep_link
    await Promise.all(
        offers.map((offer, idx) =>
            limitOffer(async () => {
                const url = String(offer.merchant_deep_link || "").trim();
                if (!/^https?:\/\//i.test(url)) return;

                const livePrice = await fetchLivePrice(url);
                if (typeof livePrice === "number" && livePrice > 0) {
                    // Only update if materially different (>= 0.01)
                    const old = typeof offer.price === "number" ? offer.price : 0;
                    if (Math.abs(livePrice - old) >= 0.01) {
                        offers[idx].price = +livePrice.toFixed(2);
                    }
                }
            })
        )
    );

    // Did any price change?
    const changed =
        JSON.stringify(offers.map(o => o.price)) !==
        JSON.stringify(prod.offers.map(o => o.price));

    if (!changed) {
        return { changed: false };
    }

    // Recompute derived metrics (mirror AWIN logic)
    const derived = computeDerivedFromOffers(offers);

    const update = {
        offers,
        cheapest_offer: derived.cheapest_offer,
        expensive_offer: derived.expensive_offer,
        savings_amount: derived.savings_amount,
        savings_percent: derived.savings_percent,
        search_price: derived.search_price,
        cheapest_price_display: derived.cheapest_price_display,
        expensive_price_display: derived.expensive_price_display,
        savings_badge: derived.savings_badge,
        offer_count_display: derived.offer_count_display,
        cheapest_vendor: derived.cheapest_vendor,
        // Optional: make product_url follow cheapest offer (like import does)
        ...(derived.cheapest_vendor?.aw_deep_link
            ? { product_url: derived.cheapest_vendor.aw_deep_link }
            : {}),
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

main();
