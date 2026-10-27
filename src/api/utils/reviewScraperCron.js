import cron from "node-cron";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";
import { getReifenRating } from "./reviewScraper.js";

dotenv.config();

const LiveProduct = mongoose.models.Product || mongoose.model("Product", Product.schema, "products");
const DEFAULT_BATCH_SIZE = 100;
const PAUSE_MS = 400;
let runInProgress = false;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Process Reifen.com products in bounded batches until there are no more products.
 * Uses MongoDB's indexed _id order instead of a large in-memory multi-field sort.
 * limit=0 processes all matching products; limit>0 caps products scanned for testing.
 */
export async function runReviewScraper({ limit = 0, batchSize = DEFAULT_BATCH_SIZE } = {}) {
    if (runInProgress) {
        console.warn("[REVIEW-CRON] Previous run still active; skipping overlapping run.");
        return { skipped: true, processed: 0, updated: 0 };
    }
    if (!Number.isSafeInteger(limit) || limit < 0 ||
        !Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000) {
        throw new Error("limit must be a non-negative integer; batchSize must be 1–1000.");
    }

    runInProgress = true;
    let processed = 0;
    let updated = 0;
    let failed = 0;
    let batchNumber = 0;
    let lastId = null;

    try {
        console.log(`[REVIEW-CRON] Starting Reifen.com scraper; batchSize=${batchSize}, limit=${limit || "all"}`);
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        const baseQuery = {
            merchant_deep_link: { $exists: true, $ne: null },
            $or: [
                { vendor: "Reifen.com" },
                { vendor: "reifen.com" },
                { "offers.vendor": /reifen\.com/i },
            ],
        };

        while (true) {
            const remaining = limit > 0 ? limit - processed : batchSize;
            if (limit > 0 && remaining <= 0) break;
            const take = Math.min(batchSize, remaining);
            const query = lastId ? { ...baseQuery, _id: { $gt: lastId } } : baseQuery;
            const products = await LiveProduct.find(query)
                .sort({ _id: 1 })
                .limit(take)
                .select({ _id: 1, ean: 1, merchant_deep_link: 1 })
                .lean();

            if (products.length === 0) break;
            batchNumber++;
            console.log(`[REVIEW-CRON] Batch ${batchNumber}: ${products.length} products`);

            for (const product of products) {
                // Advance the checkpoint even if one product fails so the run finishes.
                lastId = product._id;
                processed++;
                try {
                    const rawUrl = String(product.merchant_deep_link || "");
                    const url = rawUrl.startsWith("http")
                        ? rawUrl
                        : `https://www.reifen.com${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
                    const { rating, reviewCount, gallery_images, tyre_label_info } = await getReifenRating(url);
                    const $set = {};
                    if (rating > 0) {
                        $set.average_rating = rating;
                        $set.rating = rating;
                    }
                    if (reviewCount > 0) {
                        $set.review_count = reviewCount;
                        $set.reviews = reviewCount;
                    }
                    if (gallery_images?.length) $set.gallery_images = gallery_images;
                    if (tyre_label_info) $set.tyre_label_info = tyre_label_info;
                    if (Object.keys($set).length) {
                        $set.last_scraped_at = new Date();
                        await LiveProduct.updateOne({ _id: product._id }, { $set });
                        updated++;
                    } else {
                        failed++;
                        console.warn(`[REVIEW-CRON] No data returned for ${product.ean || product._id}`);
                    }
                } catch (err) {
                    failed++;
                    console.warn(`[REVIEW-CRON] Failed ${product.ean || product._id}: ${err.message}`);
                }
                await sleep(PAUSE_MS);
            }
            console.log(`[REVIEW-CRON] Batch ${batchNumber} complete: scanned=${processed}, updated=${updated}, no-data/errors=${failed}`);
        }

        console.log(`[REVIEW-CRON] Finished: scanned=${processed}, updated=${updated}, no-data/errors=${failed}, batches=${batchNumber}`);
        return { processed, updated, failed, batches: batchNumber };
    } finally {
        runInProgress = false;
    }
}

export function startReviewScraperCron() {
    cron.schedule("0 4 * * *", () => {
        runReviewScraper().catch((err) => console.error("[REVIEW-CRON]", err));
    });
    console.log("[CRON] Review scraper scheduled daily at 04:00 (server timezone).");
}

const isDirectRun = process.argv[1] && /reviewScraperCron\.js$/.test(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
    runReviewScraper({
        batchSize: Number(process.env.REVIEW_SCRAPER_BATCH_SIZE || DEFAULT_BATCH_SIZE),
        limit: Number(process.env.REVIEW_SCRAPER_LIMIT || 0),
    })
        .then(() => mongoose.disconnect())
        .then(() => process.exit(0))
        .catch(async (err) => {
            console.error(err);
            await mongoose.disconnect().catch(() => {});
            process.exit(1);
        });
}
