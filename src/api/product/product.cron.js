import axios from "axios";
import fs from "fs";
import path from "path";
import cron from "node-cron";
import { importAWINCsv } from "./importAWINCsv.js"; // Your import logic!
import dotenv from "dotenv";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const TEMP_CSV_PATH = path.join(process.cwd(), "uploads", "awin-hourly.csv");

// 1. Download CSV from AWIN 
async function downloadCsvFromUrl(url, dest) {
    const writer = fs.createWriteStream(dest);
    const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
    });
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

// 2. Run the full import pipeline
export async function runAwinImportJob() {
    try {
        console.log(`[AWIN CRON] Starting hourly CSV import job...`);
        await downloadCsvFromUrl(AWIN_CSV_URL, TEMP_CSV_PATH);
        await importAWINCsv(TEMP_CSV_PATH);
        console.log(`[AWIN CRON] Import complete at`, new Date().toISOString());
    } catch (err) {
        console.error("[AWIN CRON] Failed to import:", err.message);
    }
}

// 3. Schedule the job (every hour at minute 1)
export function startAwinCron() {
    cron.schedule("1 * * * *", async () => {
        await runAwinImportJob();
    });
    console.log("[AWIN CRON] Scheduled to run every hour at minute 1.");
}
