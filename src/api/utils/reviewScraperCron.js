import cron from "node-cron";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";
import { getReifenRating } from "../utils/reviewScraper.js";

dotenv.config();
mongoose.connect(process.env.MONGODB_URI);

const LiveProduct = mongoose.model("Product", Product.schema, "products");

async function runReviewScraper() {
    console.log("🔍 [CRON] Starting Reifen.com review scraping...");

    const products = await LiveProduct.find({
        vendor: "Reifen.com",
        merchant_deep_link: { $exists: true, $ne: null },
    }).lean();

    let updated = 0;
    for (const product of products) {
        try {
            const { rating, reviewCount, gallery_images, tyre_label_info } = await getReifenRating(product.merchant_deep_link);
            if (rating > 0 || reviewCount > 0) {
                await LiveProduct.updateOne({ _id: product._id }, {
                    $set: {
                        average_rating: rating,
                        review_count: reviewCount,
                        gallery_images,
                       
                        tyre_label_info,
                        last_scraped_at: new Date(),
                    },
                });
                updated++;
                console.log(`✅ Updated [${product.ean}]`);
            }
        } catch (err) {
            console.warn(`❌ Failed [${product.ean}]: ${err.message}`);
        }
    }

    console.log(`✅ [CRON] Scraping done. ${updated} products updated.`);
}

// 🕒 Cron schedule: Run once every 30 days at 09:00 AM
cron.schedule("0 9 */30 * *", runReviewScraper);
