// version script 2.0.2  uploadProductImages.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import axios from "axios";
import pLimit from "p-limit";
import fs from "fs";
import path from "path";
import sharp from "sharp";

dotenv.config();

/* ---------------- Helpers ---------------- */
function slugify(text) {
    return text
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 40);
}
const ensureLeadingSlash = p => (p.startsWith("/") ? p : `/${p}`);
const toRelImagePath = (filename, year, month) =>
    ensureLeadingSlash(path.posix.join("images", "product-image", year, month, filename));

function hostnameOf(url) {
    try { return new URL(url).hostname.toLowerCase(); } catch { return ""; }
}
function pathnameOf(url) {
    try { return new URL(url).pathname; } catch { return ""; }
}

/* --------------- Config / Paths --------------- */

// Allow ALL hosts by default (so it works for reifen.com and any other domain).
// You can restrict later via env, e.g. SOURCE_IMAGE_HOSTS="reifen.com,rubbex.com"
const RAW_HOSTS = (process.env.SOURCE_IMAGE_HOSTS || "*").trim();
const ALLOW_ALL = RAW_HOSTS === "*" || RAW_HOSTS.toLowerCase() === "all";
const SOURCE_HOSTS = ALLOW_ALL
    ? []
    : RAW_HOSTS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

function isHostAllowed(host) {
    if (!host) return false;
    if (ALLOW_ALL) return true;
    // exact domain or any subdomain
    return SOURCE_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

// Where to write images. Point this to the FS that serves `/images`.
// Keep it OUTSIDE Next’s build output so no rebuild is needed.
const envBase = (process.env.LOCAL_IMAGE_DIR || "").trim();
let BASE_IMAGE_DIR = envBase
    ? path.resolve(envBase)
    : path.resolve(process.cwd(), "../../frontend/public/images");

// Normalize if someone appended /product-image
BASE_IMAGE_DIR = BASE_IMAGE_DIR.replace(/[/\\]product-image[/\\]?$/i, "");

// Subdir by date
const now = new Date();
const YEAR = String(now.getFullYear());
const MONTH = String(now.getMonth() + 1).padStart(2, "0");

// Final target dir: <BASE>/product-image/YYYY/MM
const PRODUCT_IMAGE_DIR = path.join(BASE_IMAGE_DIR, "product-image", YEAR, MONTH);
fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });

const CONCURRENCY = Number(process.env.IMG_CONCURRENCY || 5);
const WEBP_QUALITY = Number(process.env.WEBP_QUALITY || 85);
const MAX_IMG_BYTES = Number(process.env.MAX_IMG_BYTES || 30 * 1024 * 1024);
const PROGRESS_EVERY = Math.max(1, Number(process.env.PROGRESS_EVERY || 50));

console.log("📁 BASE_IMAGE_DIR:     ", BASE_IMAGE_DIR);
console.log("📁 PRODUCT_IMAGE_DIR:  ", PRODUCT_IMAGE_DIR);
console.log("✅ HOST MODE:          ", ALLOW_ALL ? "ALLOW ALL" : SOURCE_HOSTS.join(", "));
console.log("⚙️  CONCURRENCY:        ", CONCURRENCY);
console.log("⚙️  WEBP_QUALITY:       ", WEBP_QUALITY);

/* ---------------- Mongoose ---------------- */
const LiveProduct = mongoose.model("Product", Product.schema, "products");

/* ---------------- Network ---------------- */
async function fetchBufferWithChecks(url, { timeout = 20000 } = {}) {
    const host = hostnameOf(url);
    if (!isHostAllowed(host)) throw new Error(`Blocked source host: ${host}`);

    const resp = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        maxContentLength: MAX_IMG_BYTES,
        validateStatus: s => s >= 200 && s < 400, // allow redirects
    });

    const ctype = String(resp.headers["content-type"] || "").toLowerCase();
    if (!ctype.startsWith("image/")) {
        throw new Error(`Non-image content-type: ${ctype || "unknown"}`);
    }

    const buf = Buffer.from(resp.data);
    if (!buf || buf.length === 0) throw new Error("Empty image buffer");
    return buf;
}

async function downloadAndConvertToWebP(imageUrl, outFileBase) {
    const filename = `${outFileBase}.webp`;
    const outPath = path.join(PRODUCT_IMAGE_DIR, filename);

    // reuse existing file if present
    try {
        const st = await fs.promises.stat(outPath);
        if (st.size > 0) return { outPath, filename, reused: true };
    } catch { /* not exists */ }

    const attempts = 3;
    for (let i = 1; i <= attempts; i++) {
        try {
            const buffer = await fetchBufferWithChecks(imageUrl);
            const webpBuf = await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer();
            await fs.promises.writeFile(outPath, webpBuf);
            const stat = await fs.promises.stat(outPath);
            if (stat.size <= 0) throw new Error("Written file is empty");
            return { outPath, filename, reused: false };
        } catch (err) {
            if (i === attempts) {
                console.error(`[Download] Attempt ${i}/${attempts} failed: ${imageUrl} -> ${err?.message || err}`);
                return null;
            }
            await new Promise(r => setTimeout(r, 500 * i));
        }
    }
    return null;
}

/* --------- Main --------- */
async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        // 1) Normalize any product_image like https://host/ images/product-image/... -> /images/product-image/...
        const alreadyLocal = await LiveProduct.find(
            { product_image: { $type: "string", $regex: /^https?:\/\/[^/]+\/images\/product-image\//i } },
            { product_image: 1 }
        ).lean();

        let normalized = 0;
        for (const p of alreadyLocal) {
            const pn = pathnameOf(p.product_image);
            if (pn && pn.startsWith("/images/product-image/")) {
                await LiveProduct.updateOne({ _id: p._id }, { $set: { product_image: pn } });
                normalized++;
            }
        }
        if (normalized > 0) console.log(`🔧 Normalized ${normalized} image URLs to path-only.`);

        // 2) Candidates: only true external URLs (any domain) that are NOT already under /images/product-image/
        const candidates = await LiveProduct.find(
            {
                product_image: {
                    $type: "string",
                    $regex: /^https?:\/\/[^/]+\/(?!images\/product-image\/).+/i,
                },
            },
            { product_image: 1, _id: 1, ean: 1, product_name: 1 }
        ).lean();

        const total = candidates.length;
        console.log(`\n🧮 Total images needing download: ${total}\n`);
        if (!total) {
            await mongoose.disconnect();
            console.log("✅ Nothing to do.");
            return;
        }

        const limit = pLimit(CONCURRENCY);
        let done = 0, ok = 0, fail = 0, skipped = 0;

        // Graceful Ctrl+C summary
        let interrupted = false;
        process.on("SIGINT", () => {
            if (interrupted) return;
            interrupted = true;
            console.log(`\n\n🛑 Interrupted. Progress ${done}/${total} | OK:${ok} Skipped:${skipped} Failed:${fail}`);
            process.exit(1);
        });

        await Promise.all(
            candidates.map(prod =>
                limit(async () => {
                    try {
                        const rawUrl = String(prod.product_image || "").trim();

                        // If the URL's path is actually already /images/product-image/... (and we somehow missed it),
                        // just normalize and skip downloading.
                        const pn = pathnameOf(rawUrl);
                        if (pn && pn.startsWith("/images/product-image/")) {
                            await LiveProduct.updateOne({ _id: prod._id }, { $set: { product_image: pn } });
                            skipped++;
                            return;
                        }

                        // Must be a valid external URL at this point
                        if (!/^https?:\/\//i.test(rawUrl)) {
                            fail++;
                            return;
                        }

                        const safeName = prod.product_name ? slugify(prod.product_name) : "product";
                        const safeEan = prod.ean ? String(prod.ean).replace(/[^a-z0-9]/gi, "") : String(prod._id);
                        const base = `${safeName}-${safeEan}`;

                        const result = await downloadAndConvertToWebP(rawUrl, base);
                        if (!result) {
                            fail++;
                        } else {
                            ok++;
                            const relPath = toRelImagePath(result.filename, YEAR, MONTH); // /images/product-image/YYYY/MM/file.webp
                            await LiveProduct.updateOne({ _id: prod._id }, { $set: { product_image: relPath } });
                        }
                    } finally {
                        done++;
                        if (done === 1 || done % PROGRESS_EVERY === 0 || done === total) {
                            console.log(`[Progress] ${done}/${total} (Ok: ${ok}, Skipped: ${skipped}, Fail: ${fail})`);
                        }
                    }
                })
            )
        );

        await mongoose.disconnect();
        console.log(`\n🎉 Completed. Ok: ${ok}, Skipped: ${skipped}, Failed: ${fail}, Total: ${total}\n`);
    } catch (err) {
        console.error("\n❌ Fatal error:", err?.message || err);
        process.exit(1);
    }
}

main();
