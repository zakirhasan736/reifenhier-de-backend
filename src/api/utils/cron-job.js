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
const RETRY_DELAY_MS = 2 * 60 * 1000;
// const SUCCESS_DELAY_MS = 10 * 60 * 1000;
// const SUCCESS_DELAY_MS = 24 * 60 * 60 * 1000;
const SUCCESS_DELAY_MS = 3 * 60 * 60 * 1000;
const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

let isRunning = false;

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
        cleanOldFiles();
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

        // At start of import
        await ImportMeta.findOneAndUpdate(
            { source: "AWIN" },
            {
                $set: {
                    isRunning: true,
                    done: false,
                    imported: 0,
                    updated: 0,
                    total: 0,
                    lastStarted: new Date(),
                },
            },
            { upsert: true }
        );


        console.log("[CRON] ✅ AWIN import finished successfully.");

        setTimeout(() => {
            fs.unlink(tmpPath, (err) => {
                if (err) console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
                else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
            });
        }, 20000);
    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        setTimeout(attemptCsvImport, RETRY_DELAY_MS);
    } finally {
        isRunning = false;
    }
}

cron.schedule("* * * * *", attemptCsvImport);