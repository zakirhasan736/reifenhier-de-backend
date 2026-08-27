import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";
import { getReifenRating } from "./reviewScraper.js";

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const LiveProduct = mongoose.model("Product", Product.schema, "products");

// Reuse scraper with retry
async function scrapeWithRetry(product, maxRetries = 2) {
    const url = product.merchant_deep_link.startsWith("http")
        ? product.merchant_deep_link
        : "https://www.reifen.com" + product.merchant_deep_link;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const {
                rating,
                reviewCount,
                gallery_images,
                tyre_label_info,
            } = await getReifenRating(url);

            const updateFields = {};
            if (rating > 0) updateFields.average_rating = rating;
            if (reviewCount > 0) updateFields.review_count = reviewCount;
            if (gallery_images?.length > 0) updateFields.gallery_images = gallery_images;
            if (tyre_label_info) updateFields.tyre_label_info = tyre_label_info;

            if (Object.keys(updateFields).length > 0) {
                updateFields.last_scraped_at = new Date();
                await LiveProduct.updateOne({ _id: product._id }, { $set: updateFields });
                return true;
            }
            return false;
        } catch (err) {
            console.warn(`❌ Attempt ${attempt} failed for [${product.ean}] - ${err.message}`);
            if (attempt === maxRetries + 1) return false;
            const waitMs = /429/.test(String(err.message)) ? 8000 * attempt : 1500 * attempt;
            await new Promise((r) => setTimeout(r, waitMs));
        }
    }
}

(async function scrapeMissingReifenData() {
    console.log("🆕 Checking for new/incomplete Reifen.com products after AWIN sync...");

    const products = await LiveProduct.find({
        vendor: "Reifen.com",
        merchant_deep_link: { $exists: true, $ne: null },
        $or: [
            { average_rating: { $exists: false } },
            { review_count: { $exists: false } },
            { gallery_images: { $exists: false } },
            { tyre_label_info: { $exists: false } },
            { average_rating: 0 },
            { review_count: 0 },
            { gallery_images: { $size: 0 } },
        ]
    }, {
        _id: 1,
        ean: 1,
        merchant_deep_link: 1
    }).lean();

    const total = products.length;
    if (total === 0) {
        console.log("✅ No new products found missing data.");
        process.exit();
    }

    console.log(`📦 Found ${total} incomplete Reifen.com product(s). Starting scrape...`);

    let updated = 0;
    const failed = [];

    for (let i = 0; i < total; i++) {
        const p = products[i];
        const progress = Math.round(((i + 1) / total) * 100);
        process.stdout.write(`🔄 (${i + 1}/${total}) [${progress}%] ${p.ean}...\r`);

        const success = await scrapeWithRetry(p);
        if (success) updated++;
        else failed.push(p.ean);
        await new Promise((r) => setTimeout(r, 400));
    }

    console.log(`\n✅ Done. ${updated}/${total} product(s) updated.`);

    if (failed.length > 0) {
        console.warn(`❌ ${failed.length} failed after retries:`);
        failed.forEach(ean => console.warn(`- ${ean}`));
    }

    process.exit();
})();
