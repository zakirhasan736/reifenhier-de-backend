// updateSlugsInBatches.js
import mongoose from "mongoose";
import dotenv from "dotenv";
import slugify from "slugify";
import Product from "../../models/product.js";

dotenv.config();

const BATCH_SIZE = 500;

// Build a stable, unique-ish slug using brand + cleaned name + EAN.
// This avoids per-document DB lookups and collisions.
function buildSlug(brand, name, ean) {
    const nameWithoutDim = (name || "")
        .replace(/\b\d{3}\/\d{2}\s?R\d{2}\b/g, "")
        .trim();

    const base = slugify(`${brand || "brand"} ${nameWithoutDim}`, {
        lower: true,
        strict: true,
        trim: true,
    });

    // Ensure uniqueness and stability by appending EAN when present
    const tail = ean ? `-${String(ean).trim()}` : "";
    // collapse any double dashes
    return `${base}${tail}`.replace(/-+/g, "-").replace(/^-|-$/g, "");
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Missing OR empty slugs
    const query = {
        $or: [{ slug: { $exists: false } }, { slug: null }, { slug: "" }],
    };

    const total = await Product.countDocuments(query);
    console.log(`Total products needing slug: ${total}`);

    if (!total) {
        await mongoose.disconnect();
        console.log("Nothing to update.");
        process.exit(0);
        return;
    }

    let processed = 0;
    let updated = 0;
    let failed = 0;

    // Use a cursor to avoid RAM spikes
    const cursor = Product.find(query)
        .select({
            _id: 1,
            brand_name: 1,
            product_name: 1,
            ean: 1,
            slug: 1,
        })
        .lean()
        .cursor({ batchSize: BATCH_SIZE });

    const bulkOps = [];
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
        try {
            const slug = buildSlug(doc.brand_name, doc.product_name, doc.ean);
            bulkOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: { $set: { slug } },
                },
            });
            updated++;
        } catch (e) {
            failed++;
            console.error(`Failed to build slug for ${doc._id}: ${e.message}`);
        }

        processed++;

        if (bulkOps.length >= BATCH_SIZE) {
            await Product.bulkWrite(bulkOps, { ordered: false });
            bulkOps.length = 0;
            console.log(
                `[${processed}/${total}] Updated:${updated} Failed:${failed} Left:${Math.max(
                    0,
                    total - processed
                )}`
            );
        }
    }

    if (bulkOps.length) {
        await Product.bulkWrite(bulkOps, { ordered: false });
    }

    await mongoose.disconnect();
    console.log(
        `\n✅ Slug backfill complete. Updated:${updated} Failed:${failed} Total:${total}\n`
    );
    process.exit(0);
}

run().catch(async (err) => {
    console.error("Fatal during slug backfill:", err);
    try {
        await mongoose.disconnect();
    } catch { }
    process.exit(1);
});
