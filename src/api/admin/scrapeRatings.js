// // src/scripts/scrapeRatings.js
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import Product from "../../models/product.js";
// import { getReifenRating } from "../utils/reviewScraper.js";

// dotenv.config();
// await mongoose.connect(process.env.MONGODB_URI);

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// (async function scrape() {
//     console.log("🔍 Starting Reifen.com scraper...");
 
//     const products = await LiveProduct.find({
//         vendor: "Reifen.com",
//         merchant_deep_link: { $exists: true, $ne: null },
//     });

//     let updated = 0;

//     for (const p of products) {
//         try {
//             const { rating, reviewCount } = await getReifenRating(p.merchant_deep_link);
//             if (rating > 0 || reviewCount > 0) {
//                 await LiveProduct.updateOne({ _id: p._id }, {
//                     $set: {
//                         average_rating: rating,
//                         review_count: reviewCount,
//                     }
//                 });
//                 console.log(`✅ [${p.ean}] Updated`);
//                 updated++;
//             }
//         } catch (err) {
//             console.warn(`❌ Failed [${p.ean}] - ${err.message}`);
//         }
//     }

//     console.log(`🏁 Done. ${updated} product(s) updated.`);
//     process.exit();
// })();
// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import Product from "../../models/product.js";
// import { getReifenRating } from "../utils/reviewScraper.js";

// dotenv.config();
// await mongoose.connect(process.env.MONGODB_URI);

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// (async function scrape() {
//     console.log("🔍 Starting Reifen.com scraper...");

//     const products = await LiveProduct.find({
//         "offers.vendor": "Reifen.com",
//         "offers.merchant_deep_link": { $exists: true, $ne: null },
//     });

//     const total = products.length;
//     let updated = 0;

//     console.log(`📦 Found ${total} product(s) with Reifen.com.`);

//     for (let i = 0; i < total; i++) {
//         const p = products[i];
//         const offer = (p.offers || []).find(o => o.vendor === "Reifen.com" && o.merchant_deep_link);
//         if (!offer) continue;

//         const progress = Math.round(((i + 1) / total) * 100);
//         process.stdout.write(`🔄 (${i + 1}/${total}) [${progress}%] ${p.ean}... \r`);

//         try {
//             const { rating, reviewCount,  gallery_images, tyre_label_info } = await getReifenRating(offer.merchant_deep_link);
//             console.log(`🔍 Scraped for ${p.ean}: rating = ${rating}, reviews = ${reviewCount}`); 
//             if (rating > 0 || reviewCount > 0) {
//                 await LiveProduct.updateOne({ _id: p._id }, {
//                     $set: {
//                         average_rating: rating,
//                         review_count: reviewCount,
                        
//                         // gallery_images,
//                         // tyre_label_info,
//                     }
//                 });
//                 console.log(`✅ (${i + 1}/${total}) Updated [${p.ean}]`);
//                 updated++;
//             }
//         } catch (err) {
//             console.warn(`❌ (${i + 1}/${total}) Failed [${p.ean}] - ${err.message}`);
//         }
//     }

//     console.log(`\n🏁 Done. ${updated} of ${total} product(s) updated.`);
//     console.warn(`❌ (${i + 1}/${total}) Failed [${p.ean}] - ${err.message}`);
//     process.exit();
// })();
import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../../models/product.js";
import { getReifenRating } from "../utils/reviewScraper.js";

dotenv.config();
await mongoose.connect(process.env.MONGODB_URI);

const LiveProduct = mongoose.model("Product", Product.schema, "products");

// If you want an index for speed:
await LiveProduct.collection.createIndex(
    { vendor: 1, merchant_deep_link: 1 }
);

(async function scrape() {
    console.log("🔍 Starting Reifen.com scraper...");

    // Query only for products with Reifen.com as top-level vendor
    const products = await LiveProduct.find(
        {
            vendor: "Reifen.com",
            merchant_deep_link: { $exists: true, $ne: null },
        },
        {
            _id: 1,
            ean: 1,
            merchant_deep_link: 1,
        }
    ).lean();

    const total = products.length;
    let updated = 0;

    console.log(`📦 Found ${total} product(s) with Reifen.com.`);
    for (let i = 0; i < total; i++) {
        const p = products[i];
        const url = p.merchant_deep_link.startsWith("http")
            ? p.merchant_deep_link
            : "https://www.reifen.com" + p.merchant_deep_link;

        const progress = Math.round(((i + 1) / total) * 100);
        process.stdout.write(`🔄 (${i + 1}/${total}) [${progress}%] ${p.ean}... \r`);

        try {
            const { rating, reviewCount, gallery_images, tyre_label_info } =
                await getReifenRating(url);
                console.log(`🔍 Scraped for ${p.ean}: rating = ${rating}, reviews = ${reviewCount}, gallery_images = ${gallery_images.length}, tyre_label_info = ${tyre_label_info ? "present" : "not present"}`); 

            if (rating > 0 || reviewCount > 0) {
                await LiveProduct.updateOne(
                    { _id: p._id },
                    {
                        $set: {
                            average_rating: rating,
                            review_count: reviewCount,
                            gallery_images,
                            tyre_label_info,
                        }
                    }
                );
                updated++;
                console.log(`✅ (${i + 1}/${total}) Updated [${p.ean}]`);
            }
        } catch (err) {
            console.warn(
                `❌ (${i + 1}/${total}) Failed [${p.ean}] - ${err.message}`
            );
        }
    }

    console.log(`\n🏁 Done. ${updated} of ${total} product(s) updated.`);
    process.exit();
})();
