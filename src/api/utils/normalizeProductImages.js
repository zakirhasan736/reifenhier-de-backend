// version script 1.0.1 normalizeProductImages.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";

dotenv.config();

/** Extracts only the pathname (/images/...) from a full URL */
function pathnameOf(url) {
    try {
        return new URL(url).pathname;
    } catch {
        return "";
    }
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const LiveProduct = mongoose.model("Product", Product.schema, "products");

        // Find products with product_image starting with http(s)://.../images/product-image/
        const candidates = await LiveProduct.find(
            {
                product_image: {
                    $type: "string",
                    $regex: /^https?:\/\/[^/]+\/images\/product-image\//i,
                },
            },
            { product_image: 1 }
        ).lean();

        const total = candidates.length;
        console.log(`\n🧮 Found ${total} products with absolute image URLs.`);

        if (!total) {
            console.log("✅ Nothing to normalize.");
            await mongoose.disconnect();
            return;
        }

        let done = 0;
        let updated = 0;
        let skipped = 0;

        for (const doc of candidates) {
            const pathOnly = pathnameOf(doc.product_image);
            if (pathOnly && pathOnly.startsWith("/images/product-image/")) {
                await LiveProduct.updateOne(
                    { _id: doc._id },
                    { $set: { product_image: pathOnly } }
                );
                updated++;
            } else {
                skipped++;
            }

            done++;

            // Print live progress on a single line (carriage return)
            process.stdout.write(
                `\rProgress: ${done}/${total} | Updated: ${updated} | Skipped: ${skipped}`
            );
        }

        process.stdout.write("\n"); // final newline
        console.log(
            `🎉 Completed normalization.\nUpdated: ${updated}, Skipped: ${skipped}, Total: ${total}`
        );

        await mongoose.disconnect();
    } catch (err) {
        console.error("\n❌ Fatal error:", err?.message || err);
        process.exit(1);
    }
}

main();
