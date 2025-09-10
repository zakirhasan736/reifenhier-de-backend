// version script 2.1.0  purgeUnavailableOffers_fast.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import axios from "axios";
import http from "http";
import https from "https";
import pLimit from "p-limit";
import Product from "../../models/product.js";

dotenv.config();

/* ----------------------------- Tunables / ENV ---------------------------- */
const BATCH_SIZE = Number(process.env.PURGE_BATCH_SIZE || 800);                     // products per batch
const PRODUCT_PARALLEL = Number(process.env.PURGE_PRODUCT_CONCURRENCY || 12);       // per-product assembly
const URL_PARALLEL = Number(process.env.PURGE_URL_CONCURRENCY || 48);               // url checks in flight
const HEAD_TIMEOUT_MS = Number(process.env.PURGE_HEAD_TIMEOUT_MS || 6000);
const GET_TIMEOUT_MS = Number(process.env.PURGE_GET_TIMEOUT_MS || 10000);
const MAX_HTML_BYTES = Number(process.env.PURGE_MAX_HTML_BYTES || 512 * 1024);      // 512KB
const MAX_REDIRECTS = Number(process.env.PURGE_MAX_REDIRECTS || 5);
const CACHE_MAX = Number(process.env.PURGE_CACHE_MAX || 300000);                    // cache up to 300k URLs
const DRY_RUN = String(process.env.PURGE_DRY_RUN || "false").toLowerCase() === "true";
const AGGRESSIVE_UNKNOWN =
    String(process.env.PURGE_TREAT_UNKNOWN_AS_UNAVAILABLE || "false").toLowerCase() === "true";

/* --------------------------------- Model -------------------------------- */
const LiveProduct = mongoose.model("Product", Product.schema, "products");

/* ----------------------------- HTTP keep-alive --------------------------- */
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: URL_PARALLEL * 2 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: URL_PARALLEL * 2 });
axios.defaults.httpAgent = httpAgent;
axios.defaults.httpsAgent = httpsAgent;

/* ------------------------------- Utilities ------------------------------ */
function priceToDisplay(num) {
    if (typeof num !== "number" || !isFinite(num) || num <= 0) return undefined;
    return `${num.toFixed(2).replace(".", ",")} €`;
}

function computeFromOffers(offers = []) {
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

function derivedChanges(prod, derived, removedOffers) {
    // Offer count string compare
    const changedOfferCount = (prod.offer_count_display || "") !== (derived.offer_count_display || "");
    // Numeric/string fields that define pricing UI
    const changedCore =
        (prod.cheapest_offer || 0) !== (derived.cheapest_offer || 0) ||
        (prod.expensive_offer || 0) !== (derived.expensive_offer || 0) ||
        (prod.savings_amount || 0) !== (derived.savings_amount || 0) ||
        (prod.savings_percent || "") !== (derived.savings_percent || "") ||
        (prod.search_price || 0) !== (derived.search_price || 0) ||
        (prod.cheapest_price_display || "") !== (derived.cheapest_price_display || "") ||
        (prod.expensive_price_display || "") !== (derived.expensive_price_display || "") ||
        (prod.savings_badge || "") !== (derived.savings_badge || "");

    // Cheapest vendor “identity” changes
    const oldCV = prod.cheapest_vendor || {};
    const newCV = derived.cheapest_vendor || {};
    const changedCheapestVendor =
        (oldCV.vendor_id || "") !== (newCV.vendor_id || "") ||
        (oldCV.aw_deep_link || "") !== (newCV.aw_deep_link || "");

    // Align product_url to cheapest vendor deeplink when present
    const nextProductUrl = newCV.aw_deep_link || prod.product_url || "";
    const changedProductUrl = (prod.product_url || "") !== nextProductUrl;

    return {
        hasChanges: removedOffers > 0 || changedOfferCount || changedCore || changedCheapestVendor || changedProductUrl,
        nextProductUrl,
    };
}

/* -------------------------- Availability detection ---------------------- */
function hasOutMarker(txt) {
    const t = txt;
    return (
        t.includes("out of stock") ||
        t.includes("sold out") ||
        t.includes("currently unavailable") ||
        t.includes("not available") ||
        t.includes("unavailable") ||
        t.includes("derzeit nicht verfügbar") ||
        t.includes("nicht verfügbar") ||
        t.includes("ausverkauft") ||
        t.includes("momentan nicht lieferbar") ||
        t.includes("momentan nicht verfügbar") ||
        t.includes("temporarily unavailable") ||
        t.includes("actuellement indisponible") ||
        t.includes("non disponibile") ||
        t.includes("agotado") ||
        t.includes("sin stock")
    );
}
function hasInMarker(txt) {
    const t = txt;
    return (
        t.includes("in stock") ||
        t.includes("available") ||
        t.includes("auf lager") ||
        t.includes("verfügbar") ||
        t.includes("lieferbar") ||
        t.includes("sofort lieferbar") ||
        t.includes("en stock") ||
        t.includes("disponibile") ||
        t.includes("disponible")
    );
}
function extractJsonLdAvailabilities(html) {
    const out = [];
    const rx = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = rx.exec(html))) {
        try {
            const json = JSON.parse(m[1].trim());
            scan(json);
        } catch { }
    }
    return out;
    function scan(node) {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(scan);
        if (typeof node === "object") {
            if (node["@type"] === "Offer" || node["@type"] === "AggregateOffer") {
                if (node.availability) out.push(String(node.availability).toLowerCase());
            }
            if (node["@type"] === "Product" && node.offers) scan(node.offers);
            for (const k in node) {
                if (k === "availability") out.push(String(node[k]).toLowerCase());
                else scan(node[k]);
            }
        }
    }
}
function detectFromHtml(html, status) {
    if (!status || status >= 400) return false;
    const low = html.toLowerCase();
    const av = extractJsonLdAvailabilities(low);
    if (av.some(v => v.includes("outofstock") || v.includes("discontinued"))) return false;
    if (av.some(v => v.includes("instock") || v.includes("in stock") || v.includes("available"))) return true;
    if (hasOutMarker(low)) return false;
    if (hasInMarker(low)) return true;
    if (low.includes("captcha") || low.includes("access denied")) {
        return AGGRESSIVE_UNKNOWN ? false : true;
    }
    return AGGRESSIVE_UNKNOWN ? false : true;
}
async function headOnly(url) {
    try {
        const r = await axios.head(url, {
            timeout: HEAD_TIMEOUT_MS,
            maxRedirects: MAX_REDIRECTS,
            validateStatus: s => s >= 200 && s < 400,
        });
        return r.status;
    } catch {
        return 0;
    }
}
async function getLite(url) {
    try {
        const r = await axios.get(url, {
            timeout: GET_TIMEOUT_MS,
            maxRedirects: MAX_REDIRECTS,
            maxContentLength: MAX_HTML_BYTES,
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            },
            responseType: "text",
            decompress: true,
            validateStatus: s => s >= 200 && s < 400,
        });
        const status = r.status;
        const html = typeof r.data === "string" ? r.data : "";
        return { status, html };
    } catch {
        return { status: 0, html: "" };
    }
}

/* ------------------------- URL availability checker --------------------- */
const urlCache = new Map(); // url -> boolean
function setCache(url, val) {
    urlCache.set(url, !!val);
    if (urlCache.size > CACHE_MAX) {
        const drop = Math.ceil(CACHE_MAX * 0.1);
        let i = 0;
        for (const k of urlCache.keys()) {
            urlCache.delete(k);
            if (++i >= drop) break;
        }
    }
}
function getCache(url) {
    return urlCache.has(url) ? urlCache.get(url) : undefined;
}
async function checkUrlAvailable(url) {
    if (!/^https?:\/\//i.test(String(url || ""))) return false;
    const cached = getCache(url);
    if (typeof cached === "boolean") return cached;

    const hs = await headOnly(url);
    if (hs >= 400 || hs === 0) {
        setCache(url, false);
        return false;
    }

    const { status, html } = await getLite(url);
    const ok = detectFromHtml(html, status);
    setCache(url, ok);
    return ok;
}

/* ------------------------------ DB plumbing ----------------------------- */
const baseFilter = {
    $or: [
        { merchant_deep_link: { $type: "string", $regex: /^https?:\/\//i } },
        { offers: { $elemMatch: { merchant_deep_link: { $type: "string", $regex: /^https?:\/\//i } } } },
    ],
};
const projection = {
    _id: 1,
    ean: 1,
    product_name: 1,
    product_url: 1,
    merchant_deep_link: 1,
    offers: 1,
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
function fetchCursor() {
    return LiveProduct.find(baseFilter, projection).lean().cursor({ batchSize: BATCH_SIZE });
}

/* ------------------------------ Main logic ------------------------------ */
async function processBatch(products) {
    // 1) Build unique URL set for offers
    const urlToRefs = new Map(); // url -> array of { pIdx, oIdx }
    products.forEach((p, pIdx) => {
        const offers = Array.isArray(p.offers) ? p.offers : [];
        offers.forEach((o, oIdx) => {
            const url = String(o.merchant_deep_link || "").trim();
            if (!/^https?:\/\//i.test(url)) return;
            if (!urlToRefs.has(url)) urlToRefs.set(url, []);
            urlToRefs.get(url).push({ pIdx, oIdx });
        });
    });

    // 2) Check all unique URLs concurrently
    const limitURL = pLimit(URL_PARALLEL);
    const entries = [...urlToRefs.entries()];
    await Promise.all(
        entries.map(([url]) =>
            limitURL(async () => {
                const available = await checkUrlAvailable(url);
                setCache(url, available);
            })
        )
    );

    // 3) Assemble updates/deletes
    const updates = [];
    const toDeleteIds = [];

    let updated = 0;
    let deleted = 0;
    let skipped = 0;
    let offersRemoved = 0;

    const limitAssemble = pLimit(PRODUCT_PARALLEL);
    await Promise.all(
        products.map(prod =>
            limitAssemble(async () => {
                const original = Array.isArray(prod.offers) ? prod.offers : [];
                const kept = [];
                for (let i = 0; i < original.length; i++) {
                    const url = String(original[i].merchant_deep_link || "").trim();
                    const ok = getCache(url);
                    if (ok) kept.push(original[i]);
                }

                const removedCount = original.length - kept.length;
                offersRemoved += Math.max(0, removedCount);

                if (kept.length === 0) {
                    // No available vendors left -> delete product
                    deleted += 1;
                    toDeleteIds.push(prod._id);
                    return;
                }

                // Recompute pricing fields from kept offers
                const derived = computeFromOffers(kept);
                const { hasChanges, nextProductUrl } = derivedChanges(prod, derived, removedCount);

                if (!hasChanges) {
                    skipped += 1;
                    return;
                }

                const set = {
                    offers: kept,
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
                    last_offers_purged_at: new Date(),
                };
                if (nextProductUrl && nextProductUrl !== prod.product_url) {
                    set.product_url = nextProductUrl;
                }

                updates.push({
                    updateOne: {
                        filter: { _id: prod._id },
                        update: { $set: set },
                    },
                });
                updated += 1;
            })
        )
    );

    if (!DRY_RUN) {
        if (updates.length) await LiveProduct.bulkWrite(updates, { ordered: false });
        if (toDeleteIds.length) await LiveProduct.deleteMany({ _id: { $in: toDeleteIds } });
    }

    return { updated, deleted, skipped, offersRemoved };
}

/* --------------------------------- Runner -------------------------------- */
async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const total = await countCandidates();
        console.log(`\n🔎 Products with merchant links to verify: ${total}`);
        if (!total) {
            console.log("✅ Nothing to check.");
            await mongoose.disconnect();
            return;
        }

        let processed = 0;
        let updatedTotal = 0;
        let deletedTotal = 0;
        let skippedTotal = 0;
        let offersRemovedTotal = 0;

        const cursor = fetchCursor();
        let batch = [];

        for await (const doc of cursor) {
            batch.push(doc);
            if (batch.length >= BATCH_SIZE) {
                const { updated, deleted, skipped, offersRemoved } = await processBatch(batch);
                processed += batch.length;
                updatedTotal += updated;
                deletedTotal += deleted;
                skippedTotal += skipped;
                offersRemovedTotal += offersRemoved;

                const left = Math.max(0, total - processed);
                process.stdout.write(
                    `\rUpdated: ${updatedTotal}  Deleted: ${deletedTotal}  Skipped: ${skippedTotal}  OffersRemoved: ${offersRemovedTotal}  Left: ${left}`
                );
                batch = [];
            }
        }

        if (batch.length) {
            const { updated, deleted, skipped, offersRemoved } = await processBatch(batch);
            processed += batch.length;
            updatedTotal += updated;
            deletedTotal += deleted;
            skippedTotal += skipped;
            offersRemovedTotal += offersRemoved;

            const left = Math.max(0, total - processed);
            process.stdout.write(
                `\rUpdated: ${updatedTotal}  Deleted: ${deletedTotal}  Skipped: ${skippedTotal}  OffersRemoved: ${offersRemovedTotal}  Left: ${left}`
            );
        }

        process.stdout.write("\n");
        console.log(
            `\n🎉 Done. Updated: ${updatedTotal}, Deleted: ${deletedTotal}, Skipped: ${skippedTotal}, OffersRemoved: ${offersRemovedTotal}, Total scanned: ${processed}/${total}${DRY_RUN ? " (dry-run)" : ""}`
        );

        await mongoose.disconnect();
    } catch (err) {
        console.error("\n❌ Fatal error:", err?.message || err);
        process.exit(1);
    }
}

main();
