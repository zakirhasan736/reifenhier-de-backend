// import cron from "node-cron";
// import fetch from "node-fetch";
// import AdmZip from "adm-zip";
// import fs from "fs";
// import os from "os";
// import path from "path";
// import dotenv from "dotenv";
// import { startCsvImportAsync, waitForImportToFinish } from "../product/importAWINCsv.js";
// import ImportMeta from "../../models/ImportMeta.js";

// dotenv.config();

// const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
// const RETRY_DELAY_MS = 2 * 60 * 1000;
// // const SUCCESS_DELAY_MS = 10 * 60 * 1000;
// // const SUCCESS_DELAY_MS = 24 * 60 * 60 * 1000;
// // const SUCCESS_DELAY_MS = 1 * 60 * 60 * 1000;
// const SUCCESS_DELAY_MS = 3 * 60 * 60 * 1000;
// const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

// let isRunning = false;

// if (!fs.existsSync(TEMP_DIR)) {
//     fs.mkdirSync(TEMP_DIR, { recursive: true });
// }

// function cleanOldFiles() {
//     for (const file of fs.readdirSync(TEMP_DIR)) {
//         try {
//             fs.unlinkSync(path.join(TEMP_DIR, file));
//         } catch (err) {
//             console.warn(`[CLEANUP] Failed to delete ${file}:`, err.message);
//         }
//     }
// }

// async function attemptCsvImport() {
//     if (isRunning || !AWIN_CSV_URL) return;

//     const meta = await ImportMeta.findOne({ source: "AWIN" });
//     const lastSuccess = meta?.lastSuccess?.getTime() || 0;
//     const now = Date.now();

//     if (now - lastSuccess < SUCCESS_DELAY_MS) {
//         const minutesLeft = Math.ceil((SUCCESS_DELAY_MS - (now - lastSuccess)) / 60000);
//         console.log(`[CRON] Skipping: next AWIN import in ~${minutesLeft} min.`);
//         return;
//     }

//     isRunning = true;

//     try {
//         cleanOldFiles();
//         console.log("[CRON] Downloading AWIN ZIP...");

//         const res = await fetch(AWIN_CSV_URL);
//         if (!res.ok) throw new Error("CSV fetch failed: " + res.statusText);

//         const buffer = Buffer.from(await res.arrayBuffer());
//         const zip = new AdmZip(buffer);
//         const csvEntry = zip.getEntries().find(e => e.entryName.endsWith(".csv"));
//         if (!csvEntry) throw new Error("CSV not found in ZIP");

//         const tmpPath = path.join(TEMP_DIR, `awin-${Date.now()}.csv`);
//         fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
//         console.log("[CRON] CSV extracted to:", tmpPath);

//         startCsvImportAsync(tmpPath);
//         console.log("[CRON] Import started... waiting for it to complete...");
//         await waitForImportToFinish();

//         // At start of import
//         await ImportMeta.findOneAndUpdate(
//             { source: "AWIN" },
//             {
//                 $set: {
//                     isRunning: true,
//                     done: false,
//                     imported: 0,
//                     updated: 0,
//                     total: 0,
//                     lastStarted: new Date(),
//                 },
//             },
//             { upsert: true }
//         );


//         console.log("[CRON] ✅ AWIN import finished successfully.");

//         setTimeout(() => {
//             fs.unlink(tmpPath, (err) => {
//                 if (err) console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
//                 else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
//             });
//         }, 20000);
//     } catch (err) {
//         console.error("[CRON ERROR]", err.message);
//         setTimeout(attemptCsvImport, RETRY_DELAY_MS);
//     } finally {
//         isRunning = false;
//     }
// }

// cron.schedule("* * * * *", attemptCsvImport);
/**
 * version 3.2.0 — cron-job.js (sequential AWIN + Reifen24 + scraper)
 * - Ensures steps 1–3 run sequentially
 * - Prevents overlapping runs
 * - Waits for scraper process to finish before releasing the lock
 */

import cron from "node-cron";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ImportMeta from "../../models/ImportMeta.js";
import Product from "../../models/product.js";
import { startCsvImportAsync } from "../product/importAWINCsv.js";
import { mergeOldReifen24Offers } from "../product/mergeReifen24Offers.js";
import { spawn } from "child_process";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const OLD_REIFEN24_CSV_URL = process.env.OLD_REIFEN24_CSV_URL;
const MONGO_URI = process.env.MONGODB_URI;

const RETRY_DELAY_MS = 2 * 60 * 1000; // retry delay on failure
const SUCCESS_DELAY_MS = 3 * 60 * 60 * 1000; // 3h between full imports
const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

let isRunning = false;

/* ---------------------- Mongo Connection ---------------------- */
async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
        console.log("[DB] ✅ Connected to MongoDB");
    } catch (err) {
        console.error("[DB] ❌ Connection error:", err.message);
        setTimeout(connectDB, 5000);
    }
}

/* ---------------------- Utility Helpers ---------------------- */
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

function cleanOldFiles() {
    for (const file of fs.readdirSync(TEMP_DIR)) {
        try {
            fs.unlinkSync(path.join(TEMP_DIR, file));
        } catch (err) {
            console.warn(`[CLEANUP] Failed to delete ${file}:`, err.message);
        }
    }
}

/* ---------------------- Deduplicate EANs ---------------------- */
async function removeDuplicateEANs() {
    console.log("🧹 [CLEANUP] Checking for duplicate EANs...");
    const ProductModel = mongoose.model("Product", Product.schema, "products");
    const duplicates = await ProductModel.aggregate([
        { $group: { _id: "$ean", ids: { $push: "$_id" }, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
    ]);

    let deletedCount = 0;
    for (const dup of duplicates) {
        dup.ids.shift(); // keep one
        const res = await ProductModel.deleteMany({ _id: { $in: dup.ids } });
        deletedCount += res.deletedCount;
    }

    if (deletedCount > 0)
        console.log(`✅ [CLEANUP] Removed ${deletedCount} duplicate EANs.`);
    else console.log("[CLEANUP] No duplicate EANs found.");
}

/* ---------------------- Wait until import done ---------------------- */
async function waitForImportToFinish() {
    console.log("[WAIT] Checking AWIN import status in DB...");
    let meta;
    const start = Date.now();

    while (true) {
        meta = await ImportMeta.findOne({ source: "AWIN" });
        if (!meta?.isRunning) break;
        process.stdout.write(".");
        await new Promise((r) => setTimeout(r, 5000));
    }

    const duration = ((Date.now() - start) / 1000 / 60).toFixed(1);
    console.log(`\n[WAIT] ✅ AWIN import completed (${duration} min).`);
    return meta;
}

/* ---------------------- MAIN IMPORT FLOW ---------------------- */
async function attemptCsvImport() {
    if (isRunning || !AWIN_CSV_URL) return;

    const meta = await ImportMeta.findOne({ source: "AWIN" });
    const lastSuccess = meta?.lastSuccess?.getTime() || 0;
    const now = Date.now();

    // 3h cooldown
    if (now - lastSuccess < SUCCESS_DELAY_MS) {
        const minutesLeft = Math.ceil(
            (SUCCESS_DELAY_MS - (now - lastSuccess)) / 60000
        );
        console.log(`[CRON] ⏸ Skipping: next AWIN import in ~${minutesLeft} min.`);
        return;
    }

    isRunning = true;

    try {
        /* STEP 0: Prep work */
        await removeDuplicateEANs();
        cleanOldFiles();

        /* STEP 1: AWIN import */
        console.log("🚀 [STEP 1] Downloading and importing new AWIN feed...");
        const res = await fetch(AWIN_CSV_URL);
        if (!res.ok) throw new Error("AWIN CSV fetch failed: " + res.statusText);

        const buffer = Buffer.from(await res.arrayBuffer());
        const zip = new AdmZip(buffer);
        const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith(".csv"));
        if (!csvEntry) throw new Error("CSV not found in ZIP");

        const tmpPath = path.join(TEMP_DIR, `awin-${Date.now()}.csv`);
        fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
        console.log(`[STEP 1] CSV extracted → ${tmpPath}`);

        startCsvImportAsync(tmpPath);
        console.log("[STEP 1] Waiting for AWIN import to finish...");
        const finalMeta = await waitForImportToFinish();

        // Summary
        const total = finalMeta?.total || 0;
        const imported = finalMeta?.imported || 0;
        const updated = finalMeta?.updated || 0;
        const deleted = finalMeta?.deleted || 0;
        const doneAt = finalMeta?.lastSuccess
            ? new Date(finalMeta.lastSuccess).toLocaleString()
            : "N/A";

        console.log(`
📊 [AWIN IMPORT SUMMARY]
────────────────────────────
🆕 Imported:   ${imported}
🔁 Updated:    ${updated}
🚫 Deleted:    ${deleted}
⏭ Skipped:    ${total - imported - updated}
📦 Total Rows: ${total}
🕒 Finished:   ${doneAt}
────────────────────────────
`);

        /* STEP 2: Merge Reifen24 */
        if (OLD_REIFEN24_CSV_URL) {
            console.log("🚀 [STEP 2] Merging Reifen24 offers...");
            await mergeOldReifen24Offers(OLD_REIFEN24_CSV_URL);
            console.log("✅ [STEP 2] Reifen24 merge complete.");
        } else {
            console.log("⚠️ [STEP 2] OLD_REIFEN24_CSV_URL not set, skipping merge.");
        }

        /* STEP 3: Scraper */
        console.log("🕷 [STEP 3] Running missing Reifen data scraper...");
        const scraper = spawn("node", ["src/api/utils/scrapeMissingReifenData.js"], {
            stdio: "inherit",
        });

        await new Promise((resolve) => scraper.on("close", resolve));
        console.log("✅ [STEP 3] Scraper finished successfully.");

        /* CLEANUP */
        setTimeout(() => {
            fs.unlink(tmpPath, (err) => {
                if (err)
                    console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
                else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
            });
        }, 10000);

        console.log("🎉 [CRON] Full import + merge + scraper cycle completed.");
    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        setTimeout(attemptCsvImport, RETRY_DELAY_MS);
    } finally {
        isRunning = false;
        console.log("[CRON] 🔓 Import cycle complete — ready for next run.");
    }
}

/* ---------------------- INIT + SCHEDULER ---------------------- */
await connectDB();

// Run once on startup
attemptCsvImport();

// Schedule every 5 minutes (with cooldown check inside)
cron.schedule("*/5 * * * *", async () => {
    if (isRunning) {
        console.log("[CRON] ⏳ Still running — skipping this tick.");
        return;
    }
    console.log("[CRON] 🕒 Checking AWIN import schedule...");
    await attemptCsvImport();
});

console.log("[CRON] ✅ Scheduled AWIN import + Reifen24 + scraper every 5 min.");
