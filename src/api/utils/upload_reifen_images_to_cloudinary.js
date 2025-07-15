import dotenv from "dotenv";
import mongoose from "mongoose";
import cloudinary from "cloudinary";
import axios from "axios";
import Product from "../../models/product.js"; // adjust path as needed

dotenv.config();

// Cloudinary config
cloudinary.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/yourdb"; // adjust as needed

function normalizeEAN(ean) {
    if (!ean || typeof ean !== "string") return "";
    return ean.trim().replace(/^0+/, "");
}

// Utility: upload to Cloudinary, returns secure_url
async function uploadToCloudinary(imageUrl, filename) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 60000 });
        return await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.v2.uploader.upload_stream(
                {
                    resource_type: "image",
                    public_id: `products-images/${filename}`,
                    overwrite: true,
                    folder: "products-images",
                    format: "webp"
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            uploadStream.end(response.data);
        });
    } catch (err) {
        if (err.response) {
            console.error(`[Cloudinary] Download failed: ${imageUrl}, HTTP ${err.response.status}`);
        } else if (err.code === 'ECONNRESET') {
            console.error(`[Cloudinary] Download failed: ${imageUrl}, ECONNRESET`);
        } else if (err.code === 'ETIMEDOUT') {
            console.error(`[Cloudinary] Download failed: ${imageUrl}, ETIMEDOUT`);
        } else {
            console.error(`[Cloudinary] Download failed: ${imageUrl}, ${err.message}`);
        }
        throw err;
    }
}

function isHttpUrl(str) {
    return typeof str === "string" && /^https?:\/\//i.test(str);
}

async function main() {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

    // Find all Reifen.com products with product_image NOT on Cloudinary and valid image URL
    const query = {
        $or: [
            { vendor: /reifen\.com/i },
            { merchant_name: /reifen\.com/i }
        ],
        product_image: {
            $exists: true,
            $ne: null,
            $not: /^https:\/\/res\.cloudinary\.com\//i
        }
    };

    // You can add extra checks for product_image to be an http/https url if needed

    const products = await Product.find(query).lean();

    console.log(`Found ${products.length} Reifen.com products to process.`);

    let success = 0, failed = 0, skipped = 0;

    for (let i = 0; i < products.length; ++i) {
        const prod = products[i];
        const ean = normalizeEAN(prod.ean);
        const origImgUrl = prod.product_image;
        if (!ean || !isHttpUrl(origImgUrl)) {
            skipped++;
            console.log(`[Skip] ${prod._id} EAN: ${ean} - missing or invalid image url`);
            continue;
        }

        const filename = `${ean}.webp`;
        try {
            const uploaded = await uploadToCloudinary(origImgUrl, filename);
            if (uploaded && uploaded.secure_url) {
                // Update only the product_image field
                await Product.updateOne({ _id: prod._id }, { $set: { product_image: uploaded.secure_url } });
                success++;
                console.log(`[${i + 1}/${products.length}] Uploaded and updated EAN: ${ean}`);
            } else {
                failed++;
                console.log(`[${i + 1}/${products.length}] Failed upload for EAN: ${ean}`);
            }
        } catch (err) {
            failed++;
            console.log(`[${i + 1}/${products.length}] Error for EAN: ${ean} - ${err.message}`);
        }
    }

    console.log(`Done. Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
    await mongoose.disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
