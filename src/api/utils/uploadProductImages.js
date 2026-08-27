// version script 2.1.0  uploadProductImages.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import axios from "axios";
import pLimit from "p-limit";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { isLocalProductImagePath } from "./offerUtils.js";

dotenv.config();

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

const RAW_HOSTS = (process.env.SOURCE_IMAGE_HOSTS || "*").trim();
const ALLOW_ALL = RAW_HOSTS === "*" || RAW_HOSTS.toLowerCase() === "all";
const SOURCE_HOSTS = ALLOW_ALL
    ? []
    : RAW_HOSTS.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);

function isHostAllowed(host) {
    if (!host) return false;
    if (ALLOW_ALL) return true;
    return SOURCE_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
}

const envBase = (process.env.LOCAL_IMAGE_DIR || "").trim();

function imageRoots() {
    const roots = new Set();
    if (envBase) roots.add(path.resolve(envBase.replace(/[/\\]product-image[/\\]?$/i, "")));
    roots.add(path.resolve(process.cwd(), "../reifenhier-de-frontend/public/images"));
    roots.add(path.resolve(process.cwd(), "../../frontend/public/images"));
    return [...roots];
}

const IMAGE_ROOTS = imageRoots();
const now = new Date();
const YEAR = String(now.getFullYear());
const MONTH = String(now.getMonth() + 1).padStart(2, "0");

for (const root of IMAGE_ROOTS) {
    try {
        fs.mkdirSync(path.join(root, "product-image", YEAR, MONTH), { recursive: true });
    } catch (err) {
        console.warn("Could not create image dir", root, err?.message);
    }
}

const CONCURRENCY = Number(process.env.IMG_CONCURRENCY || 5);
const WEBP_QUALITY = Number(process.env.WEBP_QUALITY || 85);
const MAX_IMG_BYTES = Number(process.env.MAX_IMG_BYTES || 30 * 1024 * 1024);
const PROGRESS_EVERY = Math.max(1, Number(process.env.PROGRESS_EVERY || 50));

console.log("📁 IMAGE_ROOTS:        ", IMAGE_ROOTS.join(" | "));
console.log("✅ HOST MODE:          ", ALLOW_ALL ? "ALLOW ALL" : SOURCE_HOSTS.join(", "));
console.log("⚙️  CONCURRENCY:        ", CONCURRENCY);

const LiveProduct = mongoose.model("Product", Product.schema, "products");

function localFileExists(relPath) {
    const relative = String(relPath || "").replace(/^\/images\//, "");
    return IMAGE_ROOTS.some(root => {
        try {
            const st = fs.statSync(path.join(root, relative));
            return st.isFile() && st.size > 0;
        } catch {
            return false;
        }
    });
}

function sourceUrl(prod) {
    const awin = String(prod.awin_image_url || "").trim();
    const current = String(prod.product_image || "").trim();
    if (/^https?:\/\//i.test(awin)) return awin;
    if (/^https?:\/\//i.test(current) && !current.includes("/images/product-image/")) return current;
    return "";
}

async function fetchBufferWithChecks(url, { timeout = 20000 } = {}) {
    const host = hostnameOf(url);
    if (!isHostAllowed(host)) throw new Error(`Blocked source host: ${host}`);

    const resp = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        maxContentLength: MAX_IMG_BYTES,
        validateStatus: s => s >= 200 && s < 400,
        headers: {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
            Referer: "https://www.awin1.com/",
        },
        maxRedirects: 5,
    });

    const ctype = String(resp.headers["content-type"] || "").toLowerCase();
    if (ctype && !ctype.startsWith("image/") && !ctype.includes("octet-stream")) {
        throw new Error(`Non-image content-type: ${ctype}`);
    }

    const buf = Buffer.from(resp.data);
    if (!buf || buf.length === 0) throw new Error("Empty image buffer");
    return buf;
}

async function downloadAndConvertToWebP(imageUrl, outFileBase) {
    const filename = `${outFileBase}.webp`;
    const relative = path.posix.join("product-image", YEAR, MONTH, filename);
    const existing = IMAGE_ROOTS.some(root => {
        try {
            const st = fs.statSync(path.join(root, relative));
            return st.isFile() && st.size > 0;
        } catch {
            return false;
        }
    });
    if (existing) return { filename, reused: true };

    const attempts = 3;
    for (let i = 1; i <= attempts; i++) {
        try {
            const buffer = await fetchBufferWithChecks(imageUrl);
            const webpBuf = await sharp(buffer).webp({ quality: WEBP_QUALITY }).toBuffer();
            let written = 0;
            for (const root of IMAGE_ROOTS) {
                try {
                    const dir = path.join(root, "product-image", YEAR, MONTH);
                    fs.mkdirSync(dir, { recursive: true });
                    const outPath = path.join(dir, filename);
                    await fs.promises.writeFile(outPath, webpBuf);
                    written++;
                } catch (err) {
                    console.warn("Could not write product image to", root, err?.message);
                }
            }
            if (!written) throw new Error("Could not write image to any root");
            return { filename, reused: false };
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

async function restoreAwinUrl(prod) {
    const awin = String(prod.awin_image_url || "").trim();
    if (!/^https?:\/\//i.test(awin)) return false;
    await LiveProduct.updateOne(
        { _id: prod._id },
        { $set: { product_image: awin } }
    );
    return true;
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

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

        const candidates = await LiveProduct.find(
            {
                $or: [
                    { product_image: { $type: "string", $regex: /^https?:\/\//i } },
                    { product_image: { $type: "string", $regex: /^\/images\/product-image\//i } },
                    { awin_image_url: { $type: "string", $regex: /^https?:\/\//i } },
                ],
            },
            { product_image: 1, awin_image_url: 1, _id: 1, ean: 1, product_name: 1 }
        ).lean();

        const total = candidates.length;
        console.log(`\n🧮 Products to check: ${total}\n`);
        if (!total) {
            await mongoose.disconnect();
            console.log("✅ Nothing to do.");
            return;
        }

        const limit = pLimit(CONCURRENCY);
        let done = 0, ok = 0, fail = 0, skipped = 0, restored = 0;

        let interrupted = false;
        process.on("SIGINT", () => {
            if (interrupted) return;
            interrupted = true;
            console.log(`\n\n🛑 Interrupted. Progress ${done}/${total} | OK:${ok} Restored:${restored} Skipped:${skipped} Failed:${fail}`);
            process.exit(1);
        });

        await Promise.all(
            candidates.map(prod =>
                limit(async () => {
                    try {
                        const rawUrl = String(prod.product_image || "").trim();
                        const pn = pathnameOf(rawUrl);

                        if (pn && pn.startsWith("/images/product-image/") && /^https?:\/\//i.test(rawUrl)) {
                            await LiveProduct.updateOne({ _id: prod._id }, { $set: { product_image: pn } });
                            skipped++;
                            return;
                        }

                        if (isLocalProductImagePath(rawUrl)) {
                            if (localFileExists(rawUrl)) {
                                skipped++;
                                return;
                            }
                            const restoredOk = await restoreAwinUrl(prod);
                            if (restoredOk) restored++;
                            else fail++;
                            return;
                        }

                        const downloadFrom = sourceUrl(prod);
                        if (!downloadFrom) {
                            fail++;
                            return;
                        }

                        const safeName = prod.product_name ? slugify(prod.product_name) : "product";
                        const safeEan = prod.ean ? String(prod.ean).replace(/[^a-z0-9]/gi, "") : String(prod._id);
                        const base = `${safeName}-${safeEan}`;

                        const result = await downloadAndConvertToWebP(downloadFrom, base);
                        if (!result) {
                            const restoredOk = await restoreAwinUrl({
                                ...prod,
                                awin_image_url: prod.awin_image_url || downloadFrom,
                            });
                            if (restoredOk) restored++;
                            else fail++;
                        } else {
                            ok++;
                            const relPath = toRelImagePath(result.filename, YEAR, MONTH);
                            const $set = { product_image: relPath };
                            if (!prod.awin_image_url && downloadFrom) $set.awin_image_url = downloadFrom;
                            await LiveProduct.updateOne({ _id: prod._id }, { $set });
                        }
                    } finally {
                        done++;
                        if (done === 1 || done % PROGRESS_EVERY === 0 || done === total) {
                            console.log(`[Progress] ${done}/${total} (Ok: ${ok}, Restored: ${restored}, Skipped: ${skipped}, Fail: ${fail})`);
                        }
                    }
                })
            )
        );

        await mongoose.disconnect();
        console.log(`\n🎉 Completed. Ok: ${ok}, Restored AWIN: ${restored}, Skipped: ${skipped}, Failed: ${fail}, Total: ${total}\n`);
    } catch (err) {
        console.error("\n❌ Fatal error:", err?.message || err);
        process.exit(1);
    }
}

main();
