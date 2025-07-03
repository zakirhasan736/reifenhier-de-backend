// import cron from "node-cron";
// import fetch from "node-fetch";
// import fs from "fs";
// import path from "path";
// import { startCsvImportAsync } from "../product/importAWINCsv.js";

// const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
// const LOCAL_CSV_PATH = path.join(process.cwd(), "uploads", "awin-products.csv");

// let lastImport = 0; // timestamp for lock

// // Every hour at minute 0
// cron.schedule("0 * * * *", async () => {
//     // Simple lock: Don't start if an import is still running
//     if (Date.now() - lastImport < 50 * 60 * 1000) { // 50 minutes lock
//         console.log("[CRON] Last import still running or too recent, skipping.");
//         return;
//     }
//     lastImport = Date.now();
//     try {
//         console.log(`[CRON] Fetching AWIN CSV from: ${AWIN_CSV_URL}`);
//         const res = await fetch(AWIN_CSV_URL);
//         if (!res.ok) throw new Error("CSV download failed: " + res.statusText);

//         await fs.promises.mkdir(path.dirname(LOCAL_CSV_PATH), { recursive: true });
//         const fileStream = fs.createWriteStream(LOCAL_CSV_PATH);
//         await new Promise((resolve, reject) => {
//             res.body.pipe(fileStream);
//             res.body.on("error", reject);
//             fileStream.on("finish", resolve);
//         });

//         // Import async/background! Does NOT block the Node.js event loop
//         startCsvImportAsync(LOCAL_CSV_PATH);
//         console.log("[CRON] AWIN CSV fetch complete, import started:", new Date());

//     } catch (err) {
//         console.error("[CRON] Error fetching/importing AWIN CSV:", err);
//     }
// });
// src/api/utils/cron-awin.js
// import cron from "node-cron";
// import fetch from "node-fetch";
// import AdmZip from "adm-zip";
// import fs from "fs";
// import os from "os";
// import path from "path";
// import dotenv from "dotenv";
// import { startCsvImportAsync } from "../product/importAWINCsv.js"; // adjust path if needed

// dotenv.config();

// const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
// let lastImport = 0;

// cron.schedule("0 * * * *", async () => {
//     if (Date.now() - lastImport < 50 * 60 * 1000) {
//         console.log("[CRON] Previous import still in cooldown. Skipping.");
//         return;
//     }

//     if (!AWIN_CSV_URL) {
//         console.error("[CRON] AWIN_CSV_URL not set in environment.");
//         return;
//     }

//     try {
//         console.log("[CRON] Downloading AWIN ZIP...");
//         const res = await fetch(AWIN_CSV_URL);
//         if (!res.ok) throw new Error(`Download failed: ${res.statusText}`);

//         const buffer = await res.buffer();
//         const zip = new AdmZip(buffer);
//         const entries = zip.getEntries();
//         const csvEntry = entries.find(e => e.entryName.endsWith(".csv"));

//         if (!csvEntry) throw new Error("CSV file not found in ZIP.");

//         const tmpPath = path.join(os.tmpdir(), `awin-${Date.now()}.csv`);
//         fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
//         console.log("[CRON] CSV extracted to:", tmpPath);

//         startCsvImportAsync(tmpPath);
//         lastImport = Date.now();
//         console.log("[CRON] AWIN import started:", new Date().toISOString());
//     } catch (err) {
//         console.error("[CRON] AWIN import failed:", err.message);
//     }
// });
import cron from "node-cron";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import { startCsvImportAsync } from "../product/importAWINCsv.js";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const RETRY_DELAY_MS = 2 * 60 * 1000; // Retry every 2 minutes on failure
const SUCCESS_DELAY_MS = 60 * 60 * 1000; // Wait 1 hour after success

let lastSuccess = 0;
let isRunning = false;

async function attemptCsvImport() {
    if (isRunning) return;
    if (!AWIN_CSV_URL) {
        console.error("[CRON] AWIN_CSV_URL not set in environment.");
        return;
    }

    const now = Date.now();
    if (now - lastSuccess < SUCCESS_DELAY_MS) return;

    isRunning = true;

    try {
        console.log("[CRON] Downloading AWIN ZIP...");
        const res = await fetch(AWIN_CSV_URL);
        if (!res.ok) throw new Error("CSV fetch failed: " + res.statusText);

        const buffer = Buffer.from(await res.arrayBuffer());
        const zip = new AdmZip(buffer);
        const csvEntry = zip.getEntries().find(e => e.entryName.endsWith(".csv"));
        if (!csvEntry) throw new Error("CSV not found in ZIP");

        const tmpPath = path.join(os.tmpdir(), `awin-${Date.now()}.csv`);
        fs.writeFileSync(tmpPath, zip.readFile(csvEntry));
        console.log("[CRON] CSV extracted to:", tmpPath);

        startCsvImportAsync(tmpPath);
        lastSuccess = Date.now();
        console.log("[CRON] AWIN import started successfully at", new Date().toISOString());
    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        // Retry after delay
        setTimeout(attemptCsvImport, RETRY_DELAY_MS);
    } finally {
        isRunning = false;
    }
}

// Kick off every 1 minute, but it will manage delay itself
cron.schedule("* * * * *", () => {
    attemptCsvImport();
});
