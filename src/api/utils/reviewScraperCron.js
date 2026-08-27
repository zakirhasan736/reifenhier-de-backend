import cron from "node-cron";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";
import { getReifenRating } from "./reviewScraper.js";

dotenv.config();

const LiveProduct = mongoose.models.Product || mongoose.model("Product", Product.schema, "products");

export async function runReviewScraper({ limit = 0 } = {}) {
    console.log("🔍 [CRON] Starting Reifen.com review scraping...");

    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const query = {
        merchant_deep_link: { $exists: true, $ne: null },
        $or: [
            { vendor: "Reifen.com" },
            { vendor: "reifen.com" },
            { "offers.vendor": /reifen\.com/i },
        ],
    };

    let finder = LiveProduct.find(query).sort({ last_scraped_at: 1, updatedAt: -1 });
    if (limit > 0) finder = finder.limit(limit);

    const products = await finder.lean();

    let updated = 0;
    for (const product of products) {
        try {
            const url = String(product.merchant_deep_link || "").startsWith("http")
                ? product.merchant_deep_link
                : `https://www.reifen.com${product.merchant_deep_link}`;
            const { rating, reviewCount, gallery_images, tyre_label_info } = await getReifenRating(url);
            if (rating > 0 || reviewCount > 0 || gallery_images?.length) {
                const $set = {
                    last_scraped_at: new Date(),
                };
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

                await LiveProduct.updateOne({ _id: product._id }, { $set });
                updated++;
                console.log(`✅ Updated [${product.ean}] rating=${rating} reviews=${reviewCount}`);
            }
            await new Promise((r) => setTimeout(r, 400));
        } catch (err) {
            console.warn(`❌ Failed [${product.ean}]: ${err.message}`);
        }
    }

    console.log(`✅ [CRON] Scraping done. ${updated}/${products.length} products updated.`);
    return { updated, total: products.length };
}

export function startReviewScraperCron() {
    cron.schedule("0 4 * * *", () => {
        runReviewScraper().catch((err) => {
            console.error("[REVIEW-CRON]", err?.message || err);
        });
    });
    console.log("[CRON] Review scraper scheduled daily at 04:00.");
}

const isDirectRun = process.argv[1] && /reviewScraperCron\.js$/.test(process.argv[1].replace(/\\/g, "/"));
if (isDirectRun) {
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => runReviewScraper())
        .then(() => mongoose.disconnect())
        .then(() => process.exit(0))
        .catch((err) => {
            console.error(err);
            process.exit(1);
        });
}
