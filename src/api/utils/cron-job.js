import cron from "node-cron";
import fetch from "node-fetch";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import { spawn } from "child_process";
import ImportMeta from "../../models/ImportMeta.js";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const RETRY_DELAY_MS = 2 * 60 * 1000;
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

        const child = spawn("node", ["src/api/utils/awinImportRunner.js", tmpPath], {
            stdio: "inherit",
            env: process.env,
        });

        child.on("exit", (code) => {
            isRunning = false;
            if (code === 0) {
                console.log("[CRON] ✅ Import child completed successfully.");
            } else {
                console.error("[CRON] ❌ Import child exited with code", code);
                setTimeout(attemptCsvImport, RETRY_DELAY_MS);
            }

            // Cleanup
            setTimeout(() => {
                fs.unlink(tmpPath, (err) => {
                    if (err) console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
                    else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
                });
            }, 10000);
        });
    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        isRunning = false;
        setTimeout(attemptCsvImport, RETRY_DELAY_MS);
    }
}

cron.schedule("* * * * *", attemptCsvImport);
