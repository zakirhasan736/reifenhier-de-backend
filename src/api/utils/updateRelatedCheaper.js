
// updateRelatedCheaperInBatches();
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const LiveProduct = mongoose.model("Product", Product.schema, "products");

async function updateRelatedCheaperInBatches(batchSize = 500) {
    const totalProductsToUpdate = await LiveProduct.countDocuments({
        $or: [
            { related_cheaper: { $exists: false } },
            { related_cheaper: { $size: 0 } },
        ],
    });

    if (totalProductsToUpdate === 0) {
        console.log("✅ No products needing related_cheaper update.");
        mongoose.disconnect();
        return;
    }

    console.log(`🔍 Found ${totalProductsToUpdate} product(s) needing update.`);

    let totalUpdated = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let round = 1;
    let processed = 0;

    while (processed < totalProductsToUpdate) {
        const products = await LiveProduct.aggregate([
            {
                $match: {
                    $or: [
                        { related_cheaper: { $exists: false } },
                        { related_cheaper: { $size: 0 } },
                    ],
                },
            },
            { $sort: { createdAt: -1 } },
            { $limit: batchSize },
            {
                $project: {
                    _id: 1,
                    width: 1,
                    height: 1,
                    diameter: 1,
                    speedIndex: 1,
                    lastIndex: 1,
                    merchant_product_third_category: 1,
                    product_category: 1,
                },
            },
        ]);

        if (!products.length) break;

        console.log(`\n📦 Batch ${round}: Processing ${products.length} products...`);

        for (let i = 0; i < products.length; i++) {
            const prod = products[i];
            const counter = `${processed + i + 1}/${totalProductsToUpdate}`;
            try {
                const competitors = await LiveProduct.aggregate([
                    {
                        $match: {
                            _id: { $ne: prod._id },
                            merchant_product_third_category: prod.merchant_product_third_category,
                            product_category: prod.product_category,
                            width: prod.width,
                            height: prod.height,
                            diameter: prod.diameter,
                            speedIndex: prod.speedIndex,
                            lastIndex: prod.lastIndex,
                        },
                    },
                    { $sort: { search_price: 1 } },
                    {
                        $group: {
                            _id: "$brand_name",
                            doc: { $first: "$$ROOT" },
                        },
                    },
                    { $replaceRoot: { newRoot: "$doc" } },
                    { $sort: { search_price: 1 } },
                    { $limit: 3 },
                    {
                        $project: {
                            _id: 1,
                            brand_name: 1,
                            product_name: 1,
                            product_url: 1,
                            search_price: 1,
                        },
                    },
                ]);

                if (!competitors.length) {
                    console.log(`🔸 (${counter}) Skipped [${prod._id}] - No competitors`);
                    totalSkipped++;
                    continue;
                }

                const related_cheaper = competitors.map((c) => ({
                    _id: c._id,
                    brand_name: c.brand_name,
                    product_name: c.product_name,
                    url: c.product_url,
                    price:
                        typeof c.search_price === "number"
                            ? c.search_price.toFixed(2).replace(".", ",")
                            : "0,00",
                }));

                await LiveProduct.updateOne({ _id: prod._id }, { $set: { related_cheaper } });

                console.log(`✅ (${counter}) Updated [${prod._id}]`);
                totalUpdated++;
            } catch (err) {
                console.error(`❌ (${counter}) Failed [${prod._id}]: ${err.message}`);
                totalFailed++;
            }
        }

        processed += products.length;
        round++;
    }

    console.log(`\n📊 Summary:
  ✅ Updated: ${totalUpdated}
  ❌ Failed : ${totalFailed}
  🔸 Skipped: ${totalSkipped}
🏁 Done.\n`);

    mongoose.disconnect();
}

updateRelatedCheaperInBatches();
