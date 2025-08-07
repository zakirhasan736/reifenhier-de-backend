// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import axios from "axios";
// import pLimit from "p-limit";
// import fs from "fs";
// import path from "path";

// function slugify(text) {
//     return text
//         .toString()
//         .normalize("NFD")
//         .replace(/[\u0300-\u036f]/g, "")
//         .toLowerCase()
//         .replace(/[^a-z0-9]+/g, "-")
//         .replace(/^-+|-+$/g, "")
//         .substring(0, 40);
// }

// dotenv.config();

// const now = new Date();
// const year = now.getFullYear();
// const month = String(now.getMonth() + 1).padStart(2, "0");
// const SUB_DIR = `${year}/${month}`;

// const BASE_IMAGE_DIR = process.env.LOCAL_IMAGE_DIR
//     ? path.resolve(process.env.LOCAL_IMAGE_DIR)
//     : path.resolve(process.cwd(), "../../frontend/public/images");
// const IMAGE_DIR = path.join(BASE_IMAGE_DIR, "product-image", SUB_DIR);
// fs.mkdirSync(IMAGE_DIR, { recursive: true });

// const FRONTEND_IMAGE_HOST = process.env.FRONTEND_IMAGE_HOST?.replace(/\/$/, "");

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// async function downloadImage(imageUrl, filename) {
//     try {
//         const outPath = path.join(IMAGE_DIR, filename);
//         const response = await axios.get(imageUrl, {
//             responseType: "stream",
//             timeout: 60000,
//         });
//         await new Promise((resolve, reject) => {
//             const stream = fs.createWriteStream(outPath);
//             response.data.pipe(stream);
//             stream.on("finish", resolve);
//             stream.on("error", reject);
//         });
//         return outPath;
//     } catch (err) {
//         const msg = err?.response?.status
//             ? `HTTP ${err.response.status}`
//             : err.code || err.message;
//         console.error(`[Download] Failed: ${imageUrl}, ${msg}`);
//         return null;
//     }
// }

// async function main() {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI);

//         const toUpdate = await LiveProduct.find(
//             {
//                 product_image: {
//                     $exists: true,
//                     $ne: null,
//                     $not: /^\/images\/product-image\//,
//                     $regex: /^https?:\/\/.*reifen\.com\//,
//                 },
//             },
//             { product_image: 1, _id: 1, ean: 1, name: 1 }
//         ).lean();

//         console.log(`Found ${toUpdate.length} products needing external image download.`);
//         if (!toUpdate.length) {
//             await mongoose.disconnect();
//             console.log("✅ No external images to process.");
//             return;
//         }

//         let count = 0,
//             success = 0,
//             failed = 0;
//         const limit = pLimit(5);

//         await Promise.all(
//             toUpdate.map((prod) =>
//                 limit(async () => {
//                     count++;
//                     const safeName = prod.name ? slugify(prod.name) : "product";
//                     const safeEan = prod.ean ? String(prod.ean).replace(/[^a-z0-9]/gi, "") : prod._id;
//                     const filename = `${safeName}-${safeEan}.webp`;

//                     console.log(`[${count}/${toUpdate.length}] Downloading: ${filename}`);

//                     const outPath = await downloadImage(prod.product_image, filename);

//                     if (outPath) {
//                         const relativePath = `/images/product-image/${SUB_DIR}/${filename}`;
//                         const fullUrl = `${FRONTEND_IMAGE_HOST}${relativePath}`;

//                         await LiveProduct.updateOne(
//                             { _id: prod._id },
//                             { $set: { product_image: fullUrl } }
//                         );

//                         console.log(`✅ Updated DB: ${fullUrl}`);
//                         success++;
//                     } else {
//                         console.error(`❌ Failed for: ${filename}`);
//                         failed++;
//                     }

//                     if (count % 10 === 0 || count === toUpdate.length) {
//                         console.log(
//                             `[Progress] ${count}/${toUpdate.length} done (Success: ${success}, Failed: ${failed})`
//                         );
//                     }
//                 })
//             )
//         );

//         await mongoose.disconnect();
//         console.log(`🎉 Completed. Success: ${success}, Failed: ${failed}`);
//     } catch (err) {
//         console.error("❌ Fatal error:", err.message);
//         process.exit(1);
//     }
// }

// main();
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";

dotenv.config();

const FRONTEND_IMAGE_HOST = process.env.FRONTEND_IMAGE_HOST?.replace(/\/$/, "");

if (!FRONTEND_IMAGE_HOST) {
    console.error("❌ FRONTEND_IMAGE_HOST is not set in .env");
    process.exit(1);
}

async function updateImageUrls() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const result = await Product.updateMany(
            {
                product_image: {
                    $exists: true,
                    $ne: null,
                    $not: /^https?:\/\//, // only update if it doesn't already include a domain
                },
            },
            [
                {
                    $set: {
                        product_image: {
                            $concat: [FRONTEND_IMAGE_HOST, "$product_image"],
                        },
                    },
                },
            ]
        );

        console.log(`✅ Updated ${result.modifiedCount} product image URLs`);
        await mongoose.disconnect();
    } catch (err) {
        console.error("❌ Error during update:", err);
        process.exit(1);
    }
}

updateImageUrls();
