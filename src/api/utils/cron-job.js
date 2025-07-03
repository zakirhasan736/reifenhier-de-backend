
// import cron from "node-cron";
// import fetch from "node-fetch";
// import AdmZip from "adm-zip";
// import fs from "fs";
// import os from "os";
// import path from "path";
// import dotenv from "dotenv";
// import { startCsvImportAsync, waitForImportToFinish } from "../product/importAWINCsv.js"; // 👈 include wait
// import ImportMeta from "../../models/ImportMeta.js";

// dotenv.config();

// const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
// const RETRY_DELAY_MS = 2 * 60 * 1000;
// const SUCCESS_DELAY_MS = 60 * 60 * 1000; // 1 hour
// const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

// let lastSuccess = 0;
// let isRunning = false;

// // Ensure temp directory exists
// if (!fs.existsSync(TEMP_DIR)) {
//     fs.mkdirSync(TEMP_DIR, { recursive: true });
// }

// function cleanOldFiles() {
//     const files = fs.readdirSync(TEMP_DIR);
//     for (const file of files) {
//         try {
//             fs.unlinkSync(path.join(TEMP_DIR, file));
//         } catch (err) {
//             console.warn(`[CLEANUP] Failed to delete ${file}:`, err.message);
//         }
//     }
// }

// async function attemptCsvImport() {
//     if (isRunning) return;
//     if (!AWIN_CSV_URL) {
//         console.error("[CRON] AWIN_CSV_URL not set in .env.");
//         return;
//     }

//     const meta = await ImportMeta.findOne({ source: "AWIN" });
//     const lastTime = meta?.lastSuccess?.getTime() || 0;
//     const now = Date.now();


//     if (now - lastTime < SUCCESS_DELAY_MS) {
//         const minutesLeft = Math.ceil((SUCCESS_DELAY_MS - (now - lastTime)) / 60000);
//         console.log(`[CRON] Skipping: Next AWIN import in ~${minutesLeft} min.`);
//         return;
//     }

//     isRunning = true;

//     try {
//         cleanOldFiles(); // 💥 Delete old files before new run

//         console.log("[CRON] Downloading AWIN ZIP...");
//         const res = await fetch(AWIN_CSV_URL);
//         if (!res.ok) throw new Error("CSV fetch failed: " + res.statusText);

//         const buffer = Buffer.from(await res.arrayBuffer());
//         const zip = new AdmZip(buffer);
//         const csvEntry = zip.getEntries().find((e) => e.entryName.endsWith(".csv"));
//         if (!csvEntry) throw new Error("CSV not found in ZIP");

//         const tmpPath = path.join(TEMP_DIR, `awin-${Date.now()}.csv`);
//         fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
//         console.log("[CRON] CSV extracted to:", tmpPath);

//         startCsvImportAsync(tmpPath);
//         console.log("[CRON] Import started... waiting for completion...");

//         await waitForImportToFinish(); // ⏳ Wait until import finishes
//         // ✅ Mark import success in DB
//         await ImportMeta.findOneAndUpdate(
//             { source: "AWIN" },
//             { $set: { lastSuccess: new Date() } },
//             { upsert: true }
//         );

//         console.log("[CRON] ✅ AWIN import finished. Delay next run by 1 hour.");

//         // 🔁 Delete temp CSV after delay
//         setTimeout(() => {
//             fs.unlink(tmpPath, (err) => {
//                 if (err) {
//                     console.error("[CLEANUP] Failed to delete CSV:", err.message);
//                 } else {
//                     console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
//                 }
//             });
//         }, 20000); // Wait 20s
//         lastSuccess = Date.now(); // ✅ Mark success AFTER full import
//         console.log("[CRON] Import finished at:", new Date().toISOString());

//         setTimeout(() => {
//             fs.unlink(tmpPath, (err) => {
//                 if (err) console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
//                 else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
//             });
//         }, 20000);

//     } catch (err) {
//         console.error("[CRON ERROR]", err.message);
//         setTimeout(attemptCsvImport, RETRY_DELAY_MS); // Retry on failure
//     } finally {
//         isRunning = false;
//     }
// }

// cron.schedule("* * * * *", () => {
//     attemptCsvImport();
// });
import cron from "node-cron";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import { startCsvImportAsync, waitForImportToFinish } from "../product/importAWINCsv.js";
import ImportMeta from "../../models/ImportMeta.js";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const RETRY_DELAY_MS = 2 * 60 * 1000;       // Retry delay on failure (2 minutes)
const SUCCESS_DELAY_MS = 60 * 60 * 1000;     // Wait 1 hour after successful import
const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

let isRunning = false;

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

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
        cleanOldFiles(); // 🧹 Clean temp directory

        console.log("[CRON] Downloading AWIN ZIP...");
        const res = await fetch(AWIN_CSV_URL);
        if (!res.ok) throw new Error("CSV fetch failed: " + res.statusText);

        const buffer = Buffer.from(await res.arrayBuffer());
        const zip = new AdmZip(buffer);
        const csvEntry = zip.getEntries().find(e => e.entryName.endsWith(".csv"));
        if (!csvEntry) throw new Error("CSV not found in ZIP");

        const tmpPath = path.join(TEMP_DIR, `awin-${Date.now()}.csv`);
        fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
        console.log("[CRON] CSV extracted to:", tmpPath);

        startCsvImportAsync(tmpPath);
        console.log("[CRON] Import started... waiting for it to complete...");
        await waitForImportToFinish();

        await ImportMeta.findOneAndUpdate(
            { source: "AWIN" },
            { $set: { lastSuccess: new Date() } },
            { upsert: true }
        );
        console.log("[CRON] ✅ AWIN import finished successfully.");

        setTimeout(() => {
            fs.unlink(tmpPath, (err) => {
                if (err) console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
                else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
            });
        }, 20000); // delete CSV after 20 seconds

    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        setTimeout(attemptCsvImport, RETRY_DELAY_MS); // retry on failure
    } finally {
        isRunning = false;
    }
}

// ⏰ Cron schedule: check every minute, self-manages delay
cron.schedule("* * * * *", attemptCsvImport);
