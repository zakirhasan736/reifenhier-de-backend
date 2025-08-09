// version script 1.0.0
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
// // version script 2.0.0  uploadProductImages.js
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import axios from "axios";
import pLimit from "p-limit";
import fs from "fs";
import path from "path";
import sharp from "sharp";

function slugify(text) {
    return text.toString()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase().replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "").substring(0, 40);
}

dotenv.config();

// ---- host validation
const FRONTEND_IMAGE_HOST = (process.env.FRONTEND_IMAGE_HOST || "").trim().replace(/\/+$/, "");
if (!/^https?:\/\//i.test(FRONTEND_IMAGE_HOST)) {
    console.error("❌ FRONTEND_IMAGE_HOST must include protocol, e.g. https://www.reifencheck.de");
    process.exit(1);
}

// ---- date subdir
const now = new Date();
const year = String(now.getFullYear());
const month = String(now.getMonth() + 1).padStart(2, "0");

// ---- base dir (strip trailing product-image if someone put it)
const envBase = (process.env.LOCAL_IMAGE_DIR || "").trim();
let BASE_IMAGE_DIR = envBase
    ? path.resolve(envBase)
    : path.resolve(process.cwd(), "../../frontend/public/images");
BASE_IMAGE_DIR = BASE_IMAGE_DIR.replace(/[/\\]product-image[/\\]?$/i, "");

const PRODUCT_IMAGE_DIR = path.join(BASE_IMAGE_DIR, "product-image", year, month);
fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });

console.log("📁 BASE_IMAGE_DIR:     ", BASE_IMAGE_DIR);
console.log("📁 PRODUCT_IMAGE_DIR:  ", PRODUCT_IMAGE_DIR);
console.log("🌐 FRONTEND_IMAGE_HOST:", FRONTEND_IMAGE_HOST);

const LiveProduct = mongoose.model("Product", Product.schema, "products");

// --- helpers
async function fetchBufferWithChecks(url, { timeout = 15000 } = {}) {
    const resp = await axios.get(url, {
        responseType: "arraybuffer",
        timeout,
        maxContentLength: 30 * 1024 * 1024, // 30MB
        validateStatus: s => s >= 200 && s < 400, // allow redirects too
    });

    const ctype = String(resp.headers["content-type"] || "").toLowerCase();
    if (!ctype.startsWith("image/")) {
        throw new Error(`Non-image content-type: ${ctype || "unknown"}`);
    }

    const buf = Buffer.from(resp.data);
    if (!buf || buf.length === 0) {
        throw new Error("Empty image buffer");
    }
    return buf;
}

async function downloadAndConvertToWebP(imageUrl, outFileBase) {
    // We will save as real .webp
    const filename = `${outFileBase}.webp`;
    const outPath = path.join(PRODUCT_IMAGE_DIR, filename);

    // simple retry loop
    const attempts = 3;
    for (let i = 1; i <= attempts; i++) {
        try {
            const buffer = await fetchBufferWithChecks(imageUrl, { timeout: 20000 });
            // Convert to webp (quality tweakable)
            const webpBuf = await sharp(buffer).webp({ quality: 85 }).toBuffer();
            await fs.promises.writeFile(outPath, webpBuf);

            // sanity check
            const stat = await fs.promises.stat(outPath);
            if (stat.size <= 0) throw new Error("Written file is empty");

            return { outPath, filename };
        } catch (err) {
            const msg = err?.message || String(err);
            console.error(`[Download] Attempt ${i}/${attempts} failed: ${imageUrl} -> ${msg}`);
            if (i === attempts) return null;
            await new Promise(r => setTimeout(r, 500 * i)); // backoff
        }
    }
    return null;
}

async function main() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);

        const toUpdate = await LiveProduct.find(
            {
                product_image: {
                    $exists: true,
                    $ne: null,
                    $not: /^\/images\/product-image\//,
                    $regex: /^https?:\/\/.*reifen\.com\//,
                },
            },
            { product_image: 1, _id: 1, ean: 1, name: 1 }
        ).lean();

        console.log(`Found ${toUpdate.length} products needing external image download.`);
        if (!toUpdate.length) {
            await mongoose.disconnect();
            console.log("✅ No external images to process.");
            return;
        }

        let count = 0, success = 0, failed = 0;
        const limit = pLimit(5);

        await Promise.all(
            toUpdate.map((prod) =>
                limit(async () => {
                    count++;
                    const safeName = prod.name ? slugify(prod.name) : "product";
                    const safeEan = prod.ean ? String(prod.ean).replace(/[^a-z0-9]/gi, "") : String(prod._id);
                    const base = `${safeName}-${safeEan}`;

                    console.log(`[${count}/${toUpdate.length}] Downloading & converting: ${base}.webp`);

                    const result = await downloadAndConvertToWebP(prod.product_image, base);

                    if (result) {
                        const { filename } = result;
                        const relativePath = `/images/product-image/${year}/${month}/${filename}`;
                        const fullUrl = `${FRONTEND_IMAGE_HOST}${relativePath}`;

                        // ✅ Update DB ONLY after successful save
                        await LiveProduct.updateOne({ _id: prod._id }, { $set: { product_image: fullUrl } });
                        console.log(`✅ Updated DB: ${fullUrl}`);
                        success++;
                    } else {
                        // ❌ leave DB as-is (still pointing to reifen.com)
                        console.error(`❌ Failed for: ${base}`);
                        failed++;
                    }

                    if (count % 10 === 0 || count === toUpdate.length) {
                        console.log(`[Progress] ${count}/${toUpdate.length} done (Success: ${success}, Failed: ${failed})`);
                    }
                })
            )
        );

        await mongoose.disconnect();
        console.log(`🎉 Completed. Success: ${success}, Failed: ${failed}`);
    } catch (err) {
        console.error("❌ Fatal error:", err.message);
        process.exit(1);
    }
}

main();
// // version script 3.0.0 uploadProductImages.js
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import axios from "axios";
// import pLimit from "p-limit";
// import fs from "fs";
// import path from "path";
// import crypto from "crypto";
// import { fileTypeFromBuffer } from "file-type";
// import ProductModel from "../../models/product.js"; // ✅ single import

// dotenv.config();

// /** ---------- CLI FLAGS ----------
//  * --dry-run              only log; do not write files or DB
//  * --recover path.jsonl   retry only failed items from a previous JSONL log
//  * --rollback path.jsonl  restore original URLs using a previous JSONL log
//  * --concurrency N        parallel downloads (default 5)
//  * --------------------------------*/
// const argv = parseArgv(process.argv.slice(2));

// function parseArgv(args) {
//     const out = { dryRun: false, recover: null, rollback: null, concurrency: 5 };
//     for (let i = 0; i < args.length; i++) {
//         const a = args[i];
//         if (a === "--dry-run") out.dryRun = true;
//         else if (a === "--recover") out.recover = args[++i];
//         else if (a === "--rollback") out.rollback = args[++i];
//         else if (a === "--concurrency") out.concurrency = Number(args[++i] || 5);
//     }
//     return out;
// }

// function slugify(text) {
//     return text
//         .toString()
//         .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
//         .toLowerCase().replace(/[^a-z0-9]+/g, "-")
//         .replace(/^-+|-+$/g, "")
//         .substring(0, 40);
// }

// // Validate and normalize host
// const FRONTEND_IMAGE_HOST = (process.env.FRONTEND_IMAGE_HOST || "")
//     .trim()
//     .replace(/\/+$/, "");
// if (!/^https?:\/\//i.test(FRONTEND_IMAGE_HOST)) {
//     console.error("❌ FRONTEND_IMAGE_HOST must include protocol, e.g. https://www.reifencheck.de");
//     process.exit(1);
// }

// // Date subdir
// const now = new Date();
// const year = String(now.getFullYear());
// const month = String(now.getMonth() + 1).padStart(2, "0");

// // Resolve base to .../public/images (never including product-image)
// const envBase = (process.env.LOCAL_IMAGE_DIR || "").trim();
// let BASE_IMAGE_DIR = envBase
//     ? path.resolve(envBase)
//     : path.resolve(process.cwd(), "../../frontend/public/images");

// // Strip a trailing product-image if present (prevents double nesting)
// BASE_IMAGE_DIR = BASE_IMAGE_DIR.replace(/[/\\]product-image[/\\]?$/i, "");

// // Final on-disk target dir
// const PRODUCT_IMAGE_DIR = path.join(BASE_IMAGE_DIR, "product-image", year, month);
// if (!argv.dryRun) fs.mkdirSync(PRODUCT_IMAGE_DIR, { recursive: true });

// // Logging setup
// const LOG_DIR = path.resolve(process.cwd(), "logs");
// if (!argv.dryRun) fs.mkdirSync(LOG_DIR, { recursive: true });
// const stamp = new Date().toISOString().replace(/[:.]/g, "-");
// const LOG_JSONL = path.join(LOG_DIR, `upload-${stamp}.jsonl`);
// const LOG_CSV = path.join(LOG_DIR, `summary-${stamp}.csv`);
// const csvRows = [["product_id", "status", "old_url", "new_url", "reason"].join(",")];

// function quoteCsv(v) {
//     return `"${String(v ?? "").replace(/"/g, '""')}"`;
// }

// function logJsonl(obj) {
//     const line = JSON.stringify(obj);
//     if (argv.dryRun) { console.log(line); return; }
//     fs.appendFileSync(LOG_JSONL, line + "\n");
// }

// // Helpful diagnostics
// console.log("📁 BASE_IMAGE_DIR:     ", BASE_IMAGE_DIR);
// console.log("📁 PRODUCT_IMAGE_DIR:  ", PRODUCT_IMAGE_DIR);
// console.log("🌐 FRONTEND_IMAGE_HOST:", FRONTEND_IMAGE_HOST);
// console.log("⚙️  Options:", argv);

// // Mongo model
// const LiveProduct = mongoose.model("Product", ProductModel.schema, "products");

// /** ------- Utilities ------- */
// async function fetchBufferWithChecks(url, { timeout = 20000, attempts = 3 } = {}) {
//     let lastErr;
//     for (let i = 1; i <= attempts; i++) {
//         try {
//             const resp = await axios.get(url, {
//                 responseType: "arraybuffer",
//                 timeout,
//                 maxContentLength: 30 * 1024 * 1024,
//                 validateStatus: s => s >= 200 && s < 400, // allow redirects
//             });
//             const buf = Buffer.from(resp.data);
//             if (!buf?.length) throw new Error("Empty response");
//             const ctype = String(resp.headers["content-type"] || "").toLowerCase();
//             if (!ctype.startsWith("image/")) {
//                 throw new Error(`Non-image content-type: ${ctype || "unknown"}`);
//             }
//             return { buf, headers: resp.headers };
//         } catch (e) {
//             lastErr = e;
//             console.error(`[Download] Attempt ${i}/${attempts} failed: ${e?.message || e}`);
//             if (i < attempts) await new Promise(r => setTimeout(r, 400 * i));
//         }
//     }
//     throw lastErr || new Error("Download failed");
// }

// function sha256(buffer) {
//     return crypto.createHash("sha256").update(buffer).digest("hex");
// }

// function listFilesRecursive(dir) {
//     const acc = [];
//     if (!fs.existsSync(dir)) return acc;
//     const entries = fs.readdirSync(dir, { withFileTypes: true });
//     for (const e of entries) {
//         const p = path.join(dir, e.name);
//         if (e.isDirectory()) acc.push(...listFilesRecursive(p));
//         else acc.push(p);
//     }
//     return acc;
// }

// /** Build an index of existing images by hash -> relative path */
// function buildExistingIndex() {
//     const root = path.join(BASE_IMAGE_DIR, "product-image");
//     const files = listFilesRecursive(root);
//     const map = new Map();
//     for (const f of files) {
//         try {
//             const buf = fs.readFileSync(f);
//             if (!buf.length) continue;
//             const h = sha256(buf);
//             const rel = f.replace(BASE_IMAGE_DIR, "").replace(/\\/g, "/");
//             if (!map.has(h)) map.set(h, rel);
//         } catch {
//             /* ignore unreadable */
//         }
//     }
//     console.log(`🔎 Indexed ${map.size} unique existing images under product-image/`);
//     return map;
// }

// /** Save buffer to disk only if not dry-run */
// async function writeFileSafe(fullPath, buf) {
//     if (argv.dryRun) return;
//     await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
//     await fs.promises.writeFile(fullPath, buf);
// }

// /** ---------- Main modes ---------- */
// async function doRollback(fromJsonl) {
//     if (!fs.existsSync(fromJsonl)) {
//         console.error(`❌ Rollback log not found: ${fromJsonl}`);
//         process.exit(1);
//     }
//     const lines = fs.readFileSync(fromJsonl, "utf-8").trim().split("\n");
//     let updated = 0, skipped = 0, errors = 0;

//     await mongoose.connect(process.env.MONGODB_URI);

//     for (const line of lines) {
//         if (!line) continue;
//         let rec;
//         try { rec = JSON.parse(line); } catch { continue; }
//         const { product_id, old_url, new_url, status } = rec;
//         if (!product_id || !old_url || !new_url) { skipped++; continue; }
//         if (status !== "success") { skipped++; continue; }

//         try {
//             if (argv.dryRun) {
//                 console.log(`[Rollback DRY] ${product_id} -> ${old_url}`);
//             } else {
//                 await LiveProduct.updateOne({ _id: product_id }, { $set: { product_image: old_url } });
//             }
//             updated++;
//         } catch (e) {
//             console.error(`Rollback error for ${product_id}: ${e.message}`);
//             errors++;
//         }
//     }

//     await mongoose.disconnect();
//     console.log(`↩️  Rollback complete. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errors}`);
// }

// async function doRecover(fromJsonl) {
//     if (!fs.existsSync(fromJsonl)) {
//         console.error(`❌ Recover log not found: ${fromJsonl}`);
//         process.exit(1);
//     }
//     const lines = fs.readFileSync(fromJsonl, "utf-8").trim().split("\n");
//     const tasks = [];
//     for (const line of lines) {
//         if (!line) continue;
//         let rec; try { rec = JSON.parse(line); } catch { continue; }
//         if (rec.status === "failed" && rec.old_url && rec.product_id) {
//             tasks.push({ _id: rec.product_id, product_image: rec.old_url, name: rec.name, ean: rec.ean });
//         }
//     }
//     console.log(`🧪 Recovering ${tasks.length} failed items from log...`);
//     await processProducts(tasks);
// }

// async function doNormalRun() {
//     await mongoose.connect(process.env.MONGODB_URI);

//     const toUpdate = await LiveProduct.find(
//         {
//             product_image: {
//                 $exists: true,
//                 $ne: null,
//                 $not: /^\/images\/product-image\//,
//                 $regex: /^https?:\/\/.*reifen\.com\//,
//             },
//         },
//         { product_image: 1, _id: 1, ean: 1, name: 1 }
//     ).lean();

//     console.log(`Found ${toUpdate.length} products needing external image download.`);
//     if (!toUpdate.length) {
//         await mongoose.disconnect();
//         console.log("✅ No external images to process.");
//         return;
//     }

//     await processProducts(toUpdate);
//     await mongoose.disconnect();
// }

// /** ---------- Core processor ---------- */
// async function processProducts(items) {
//     const limit = pLimit(Math.max(1, Number(argv.concurrency) || 5));
//     const existingIndex = buildExistingIndex();

//     let count = 0, success = 0, failed = 0, skipped = 0;

//     await Promise.all(items.map(prod => limit(async () => {
//         count++;
//         const safeName = prod.name ? slugify(prod.name) : "product";
//         const safeEan = prod.ean ? String(prod.ean).replace(/[^a-z0-9]/gi, "") : String(prod._id);
//         const baseName = `${safeName}-${safeEan}`;

//         try {
//             // Fetch (with retries) + content-type check
//             const { buf } = await fetchBufferWithChecks(prod.product_image);
//             const hash = sha256(buf);

//             // Duplicate check: already have this exact image anywhere?
//             if (existingIndex.has(hash)) {
//                 const existingRel = existingIndex.get(hash);
//                 const localUrl = `${FRONTEND_IMAGE_HOST}${existingRel}`;
//                 // Update DB to point to existing file (or log in dry-run)
//                 if (!argv.dryRun) {
//                     await LiveProduct.updateOne({ _id: prod._id }, { $set: { product_image: localUrl } });
//                 }
//                 logJsonl({
//                     ts: new Date().toISOString(),
//                     product_id: String(prod._id),
//                     name: prod.name || null,
//                     ean: prod.ean || null,
//                     old_url: prod.product_image,
//                     new_url: localUrl,
//                     status: "skipped-duplicate",
//                     reason: "hash-match",
//                 });
//                 csvRows.push([prod._id, "skipped-duplicate", prod.product_image, localUrl, "hash-match"].map(quoteCsv).join(","));
//                 skipped++;
//                 if (count % 10 === 0 || count === items.length) {
//                     console.log(`[Progress] ${count}/${items.length} (OK: ${success}, Skip: ${skipped}, Fail: ${failed})`);
//                 }
//                 return;
//             }

//             // Determine extension via file-type (no conversion)
//             let ext = "bin";
//             const ft = await fileTypeFromBuffer(buf);
//             if (ft?.ext) ext = ft.ext; // jpg, png, webp, etc.

//             const filename = `${baseName}.${ext}`;
//             const outPath = path.join(PRODUCT_IMAGE_DIR, filename);

//             // Write file (unless dry-run)
//             await writeFileSafe(outPath, buf);

//             // Sanity check
//             if (!argv.dryRun) {
//                 const stat = await fs.promises.stat(outPath);
//                 if (!stat.size) throw new Error("Written file is empty");
//             }

//             const relativePath = `/images/product-image/${year}/${month}/${filename}`;
//             const fullUrl = `${FRONTEND_IMAGE_HOST}${relativePath}`;

//             // Update DB only on success
//             if (!argv.dryRun) {
//                 await LiveProduct.updateOne({ _id: prod._id }, { $set: { product_image: fullUrl } });
//             }

//             // Update our in-memory hash index so later items can dedupe against this newly stored file
//             existingIndex.set(hash, relativePath);

//             logJsonl({
//                 ts: new Date().toISOString(),
//                 product_id: String(prod._id),
//                 name: prod.name || null,
//                 ean: prod.ean || null,
//                 old_url: prod.product_image,
//                 new_url: fullUrl,
//                 status: "success",
//                 reason: null,
//             });
//             csvRows.push([prod._id, "success", prod.product_image, fullUrl, ""].map(quoteCsv).join(","));
//             success++;
//         } catch (e) {
//             const reason = e?.message || String(e);
//             logJsonl({
//                 ts: new Date().toISOString(),
//                 product_id: String(prod._id),
//                 name: prod.name || null,
//                 ean: prod.ean || null,
//                 old_url: prod.product_image,
//                 new_url: null,
//                 status: "failed",
//                 reason,
//             });
//             csvRows.push([prod._id, "failed", prod.product_image, "", reason].map(quoteCsv).join(","));
//             failed++;
//             console.error(`❌ [${count}/${items.length}] ${baseName} -> ${reason}`);
//         }

//         if (count % 10 === 0 || count === items.length) {
//             console.log(`[Progress] ${count}/${items.length} (OK: ${success}, Skip: ${skipped}, Fail: ${failed})`);
//         }
//     })));

//     // Write CSV summary
//     if (!argv.dryRun) {
//         fs.writeFileSync(LOG_CSV, csvRows.join("\n") + "\n");
//     }
//     console.log(`\n🎯 Done. Success: ${success}, Skipped(dupes): ${skipped}, Failed: ${failed}`);
//     if (!argv.dryRun) {
//         console.log(`📝 Logs: ${LOG_JSONL}`);
//         console.log(`🧾 CSV : ${LOG_CSV}`);
//     }
// }

// /** ---------- Entrypoint ---------- */
// (async () => {
//     try {
//         if (argv.rollback) {
//             await doRollback(argv.rollback);
//             return;
//         }
//         if (argv.recover) {
//             await doRecover(argv.recover);
//             return;
//         }
//         await doNormalRun();
//     } catch (err) {
//         console.error("❌ Fatal error:", err?.message || err);
//         process.exit(1);
//     }
// })();
