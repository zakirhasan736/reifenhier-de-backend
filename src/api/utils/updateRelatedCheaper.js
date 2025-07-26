import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";

dotenv.config();
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const LiveProduct = mongoose.model("Product", Product.schema, "products");

async function updateRelatedCheaper() {
    const products = await LiveProduct.find({}, {
        _id: 1,
        width: 1,
        height: 1,
        diameter: 1,
        speedIndex: 1,
        lastIndex: 1,
        merchant_product_third_category: 1,
        product_category: 1,
    }).lean();

    console.log(`🔍 Found ${products.length} products to update related competitors...`);

    for (const prod of products) {
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
                    }
                },
                { $sort: { search_price: 1 } },
                {
                    $group: {
                        _id: "$brand_name",
                        doc: { $first: "$$ROOT" }
                    }
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
                        search_price: 1
                    }
                }
            ]);

            const related_cheaper = competitors.map(c => ({
                _id: c._id,
                brand_name: c.brand_name,
                product_name: c.product_name,
                url: c.product_url,
                price: typeof c.search_price === "number"
                    ? c.search_price.toFixed(2).replace(".", ",")
                    : "0,00",
            }));

            await LiveProduct.updateOne({ _id: prod._id }, { $set: { related_cheaper } });
            console.log(`✅ Updated related_cheaper for ${prod._id}`);
        } catch (err) {
            console.error(`❌ Error updating product ${prod._id}:`, err.message);
        }
    }

    console.log("🏁 All done!");
    mongoose.disconnect();
}

updateRelatedCheaper();
