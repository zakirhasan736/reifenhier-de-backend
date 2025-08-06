// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import cloudinary from "cloudinary";
// import axios from "axios";
// import pLimit from "p-limit";

// dotenv.config();

// cloudinary.v2.config({
//     cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//     api_key: process.env.CLOUDINARY_API_KEY,
//     api_secret: process.env.CLOUDINARY_API_SECRET,
// });

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// const isCloudinaryUrl = url => typeof url === "string" && (
//     url.includes("cloudinary.com") ||
//     /^https?:\/\/res\.cloudinary\.com/.test(url)
// );

// async function uploadToCloudinary(imageUrl, filename) {
//     try {
//         const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
//         return await new Promise((resolve, reject) => {
//             const uploadStream = cloudinary.v2.uploader.upload_stream(
//                 {
//                     resource_type: "image",
//                     public_id: `products/${filename}`,
//                     overwrite: true,
//                     folder: "products-images",
//                     format: "webp"
//                 },
//                 (error, result) => {
//                     if (error) reject(error);
//                     else resolve(result);
//                 }
//             );
//             uploadStream.end(response.data);
//         });
//     } catch (err) {
//         if (err.response) {
//             console.error(`[Cloudinary] Download failed: ${imageUrl}, HTTP ${err.response.status}`);
//         } else if (err.code) {
//             console.error(`[Cloudinary] Download failed: ${imageUrl}, Code: ${err.code}`);
//         } else {
//             console.error(`[Cloudinary] Download failed: ${imageUrl}, ${err.message}`);
//         }
//         return null;
//     }
// }

// async function main() {
//     try {
//         await mongoose.connect(process.env.MONGODB_URI);

//         // Only select product_image, _id, ean to save memory
//         const toUpdate = await LiveProduct.find({
//             product_image: { $exists: true, $ne: null },
//             $or: [
//                 { product_image: { $not: /cloudinary\.com/ } },
//                 { product_image: { $not: /^https?:\/\/res\.cloudinary\.com/ } }
//             ]
//         }, { product_image: 1, _id: 1, ean: 1 }).lean();

//         console.log(`---`);
//         console.log(`Found ${toUpdate.length} products needing external image upload to Cloudinary.`);
//         if (!toUpdate.length) {
//             await mongoose.disconnect();
//             console.log("✅ No external images found that need upload.");
//             return;
//         }

//         let count = 0, success = 0, failed = 0;
//         const limit = pLimit(5); // max 5 at a time

//         await Promise.all(toUpdate.map(prod => limit(async () => {
//             if (!prod.product_image || isCloudinaryUrl(prod.product_image)) return;
//             count++;
//             console.log(`[${count}/${toUpdate.length}] Uploading EAN: ${prod.ean} | URL: ${prod.product_image}`);
//             const filename = `${prod.ean || prod._id}.webp`;
//             const uploaded = await uploadToCloudinary(prod.product_image, filename);
//             if (uploaded && uploaded.secure_url) {
//                 await LiveProduct.updateOne(
//                     { _id: prod._id },
//                     { $set: { product_image: uploaded.secure_url } }
//                 );
//                 console.log(`[Cloudinary] ✅ Uploaded and updated in DB: ${filename} (EAN: ${prod.ean})`);
//                 success++;
//             } else {
//                 console.error(`[Cloudinary] ❌ Failed for EAN: ${prod.ean}`);
//                 failed++;
//             }
//             // Progress every 10 images
//             if (count % 10 === 0 || count === toUpdate.length) {
//                 console.log(`[Progress] Processed ${count}/${toUpdate.length} images (Success: ${success}, Failed: ${failed})`);
//             }
//         })));

//         await mongoose.disconnect();
//         console.log(`✅ All images processed! Success: ${success}, Failed: ${failed}, Total: ${toUpdate.length}`);
//     } catch (err) {
//         console.error("Fatal error:", err.message);
//         process.exit(1);
//     }
// }

// main();
// backend/scripts/download_product_images.js

import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import axios from "axios";
import pLimit from "p-limit";
import fs from "fs";
import path from "path";

function slugify(text) {
    return text
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .substring(0, 40);
}

dotenv.config();

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, "0");
const SUB_DIR = `${year}/${month}`;

const BASE_IMAGE_DIR = process.env.LOCAL_IMAGE_DIR
    ? path.resolve(process.env.LOCAL_IMAGE_DIR)
    : path.resolve(process.cwd(), "../../frontend/public/images");
const IMAGE_DIR = path.join(BASE_IMAGE_DIR, SUB_DIR);

fs.mkdirSync(IMAGE_DIR, { recursive: true });

const LiveProduct = mongoose.model("Product", Product.schema, "products");

async function downloadImage(imageUrl, filename) {
    try {
        const outPath = path.join(IMAGE_DIR, filename);
        const response = await axios.get(imageUrl, { responseType: "stream", timeout: 60000 });
        await new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(outPath);
            response.data.pipe(stream);
            stream.on("finish", resolve);
            stream.on("error", reject);
        });
        return outPath;
    } catch (err) {
        if (err.response) {
            console.error(`[Download] Failed: ${imageUrl}, HTTP ${err.response.status}`);
        } else if (err.code) {
            console.error(`[Download] Failed: ${imageUrl}, Code: ${err.code}`);
        } else {
            console.error(`[Download] Failed: ${imageUrl}, ${err.message}`);
        }
        return null;
    }
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // Only images that are NOT already migrated (don't start with /images/)
        // AND are either reifen.com or cloudinary.com
        const toUpdate = await LiveProduct.find({
            product_image: {
                $exists: true,
                $ne: null,
                $not: /^\/images\/product-images\//,
                $regex: /^https?:\/\/.*reifen\.com\//
            }
        }, { product_image: 1, _id: 1, ean: 1, name: 1 }).lean();

        console.log(`---`);
        console.log(`Found ${toUpdate.length} products needing external image download.`);
        if (!toUpdate.length) {
            await mongoose.disconnect();
            console.log("✅ No external images found that need upload.");
            return;
        }

        let count = 0, success = 0, failed = 0;
        const limit = pLimit(5); // up to 5 parallel downloads

        await Promise.all(toUpdate.map(prod => limit(async () => {
            count++;

            const safeName = prod.name ? slugify(prod.name) : "product";
            const safeEan = prod.ean ? String(prod.ean).replace(/[^a-z0-9]/gi, "") : prod._id;
            const filename = `${safeName}-${safeEan}.webp`;

            console.log(`[${count}/${toUpdate.length}] Downloading: ${filename} | URL: ${prod.product_image}`);
            const outPath = await downloadImage(prod.product_image, filename);

            if (outPath) {
                const relativePath = `/images/product-images/${SUB_DIR}/${filename}`;
                await LiveProduct.updateOne(
                    { _id: prod._id },
                    { $set: { product_image: relativePath } }
                );
                console.log(`[Local] ✅ Downloaded and updated: ${filename}`);
                success++;
            } else {
                console.error(`[Local] ❌ Failed for: ${filename}`);
                failed++;
            }
            if (count % 10 === 0 || count === toUpdate.length) {
                console.log(`[Progress] ${count}/${toUpdate.length} done (Success: ${success}, Failed: ${failed})`);
            }
        })));

        await mongoose.disconnect();
        console.log(`✅ Done! Success: ${success}, Failed: ${failed}, Total: ${toUpdate.length}`);
    } catch (err) {
        console.error("Fatal error:", err.message);
        process.exit(1);
    }
}

main();
