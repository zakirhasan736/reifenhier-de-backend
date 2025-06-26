import cron from "node-cron";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { startCsvImportAsync } from "../product/importAWINCsv.js";

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const LOCAL_CSV_PATH = path.join(process.cwd(), "uploads", "awin-products.csv");

let lastImport = 0; // timestamp for lock

// Every hour at minute 0
cron.schedule("0 * * * *", async () => {
    // Simple lock: Don't start if an import is still running
    if (Date.now() - lastImport < 50 * 60 * 1000) { // 50 minutes lock
        console.log("[CRON] Last import still running or too recent, skipping.");
        return;
    }
    lastImport = Date.now();
    try {
        console.log(`[CRON] Fetching AWIN CSV from: ${AWIN_CSV_URL}`);
        const res = await fetch(AWIN_CSV_URL);
        if (!res.ok) throw new Error("CSV download failed: " + res.statusText);

        await fs.promises.mkdir(path.dirname(LOCAL_CSV_PATH), { recursive: true });
        const fileStream = fs.createWriteStream(LOCAL_CSV_PATH);
        await new Promise((resolve, reject) => {
            res.body.pipe(fileStream);
            res.body.on("error", reject);
            fileStream.on("finish", resolve);
        });

        // Import async/background! Does NOT block the Node.js event loop
        startCsvImportAsync(LOCAL_CSV_PATH);
        console.log("[CRON] AWIN CSV fetch complete, import started:", new Date());

    } catch (err) {
        console.error("[CRON] Error fetching/importing AWIN CSV:", err);
    }
});
