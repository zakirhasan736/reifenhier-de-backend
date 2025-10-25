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
// version script 3.0.0 — cron-job.js
import cron from "node-cron";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ImportMeta from "../../models/ImportMeta.js";
import { startCsvImportAsync, waitForImportToFinish } from "../product/importAWINCsv.js";
import { mergeOldReifen24Offers } from "../product/mergeReifen24Offers.js";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const OLD_REIFEN24_CSV_URL = process.env.OLD_REIFEN24_CSV_URL;
const MONGO_URI = process.env.MONGODB_URI;

const RETRY_DELAY_MS = 2 * 60 * 1000;
const SUCCESS_DELAY_MS = 3 * 60 * 60 * 1000;
const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

let isRunning = false;

// Mongo connect
async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log("[DB] ✅ Connected to MongoDB");
    } catch (err) {
        console.error("[DB] ❌ Connection error:", err.message);
        setTimeout(connectDB, 5000);
    }
}

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

async function attemptCsvImport() {
    if (isRunning || !AWIN_CSV_URL) return;

    const meta = await ImportMeta.findOne({ source: "AWIN" });
    const lastSuccess = meta?.lastSuccess?.getTime() || 0;
    const now = Date.now();

    if (now - lastSuccess < SUCCESS_DELAY_MS) {
        const minutesLeft = Math.ceil((SUCCESS_DELAY_MS - (now - lastSuccess)) / 60000);
        console.log(`[CRON] Skipping: next AWIN import in ~${minutesLeft} min.`);
        return;
    }

    isRunning = true;

    try {
        cleanOldFiles();
        console.log("🚀 [CRON] Step 1: Downloading and importing new AWIN feed...");

        const res = await fetch(AWIN_CSV_URL);
        if (!res.ok) throw new Error("AWIN CSV fetch failed: " + res.statusText);

        const buffer = Buffer.from(await res.arrayBuffer());
        const zip = new AdmZip(buffer);
        const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith(".csv"));
        if (!csvEntry) throw new Error("CSV not found in ZIP");

        const tmpPath = path.join(TEMP_DIR, `awin-${Date.now()}.csv`);
        fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
        console.log(`[CRON] CSV extracted → ${tmpPath}`);

        // Step 1: run new AWIN import
        startCsvImportAsync(tmpPath);
        console.log("[CRON] Waiting for AWIN import to finish...");
        await waitForImportToFinish();

        console.log("✅ [CRON] Step 1 complete — AWIN import done.");

        // Step 2: merge Reifen24 offers
        if (OLD_REIFEN24_CSV_URL) {
            console.log("🚀 [CRON] Step 2: Merging Reifen24 offers from old feed...");
            await mergeOldReifen24Offers(OLD_REIFEN24_CSV_URL);
            console.log("✅ [CRON] Step 2 complete — Reifen24 merge done.");
        } else {
            console.log("⚠️ [CRON] OLD_REIFEN24_CSV_URL not set, skipping merge.");
        }

        console.log("🎉 [CRON] Full import and merge cycle finished successfully.");
    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        setTimeout(attemptCsvImport, RETRY_DELAY_MS);
    } finally {
        isRunning = false;
    }
}

// Initialize and schedule
await connectDB();
cron.schedule("* * * * *", attemptCsvImport);
console.log("[CRON] Scheduled AWIN import + Reifen24 merge every minute (dev mode).");
