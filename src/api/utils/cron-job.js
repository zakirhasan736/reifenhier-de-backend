/**
 * cron-job.js — AWIN CSV import + optional scraper
 * - Downloads AWIN_CSV_URL (ZIP) and imports into MongoDB
 * - Prevents overlapping runs
 * - 3h cooldown between successful full imports
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
import { spawn } from "child_process";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const MONGO_URI = process.env.MONGODB_URI;

const RETRY_DELAY_MS = 2 * 60 * 1000;
const SUCCESS_DELAY_MS = 3 * 60 * 60 * 1000; // 3h between full imports
const TEMP_DIR = path.join(os.tmpdir(), "awin-csvs");

let isRunning = false;

async function connectDB() {
    try {
        await mongoose.connect(MONGO_URI);
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

async function attemptCsvImport() {
    if (isRunning) return;
    if (!AWIN_CSV_URL) {
        console.warn("[CRON] ⚠️ AWIN_CSV_URL is not set — skipping import.");
        return;
    }

    const meta = await ImportMeta.findOne({ source: "AWIN" });
    const lastSuccess = meta?.lastSuccess?.getTime() || 0;
    const now = Date.now();

    // If import history was cleared, allow immediate run
    if (!meta) {
        console.log("[CRON] No ImportMeta record — running first import.");
    } else if (meta.isRunning) {
        const started = meta.lastStarted?.getTime() || 0;
        const stuckMs = 6 * 60 * 60 * 1000; // 6h
        if (started && now - started > stuckMs) {
            console.warn("[CRON] Resetting stuck isRunning flag (>6h).");
            await ImportMeta.updateOne({ source: "AWIN" }, { $set: { isRunning: false } });
        } else {
            console.log("[CRON] ⏳ Import already running — skipping.");
            return;
        }
    }

    if (now - lastSuccess < SUCCESS_DELAY_MS) {
        const minutesLeft = Math.ceil(
            (SUCCESS_DELAY_MS - (now - lastSuccess)) / 60000
        );
        console.log(`[CRON] ⏸ Skipping: next AWIN import in ~${minutesLeft} min.`);
        return;
    }

    isRunning = true;

    try {
        await removeDuplicateEANs();
        cleanOldFiles();

        console.log("🚀 [STEP 1] Downloading and importing AWIN feed...");
        const cidMatch = AWIN_CSV_URL.match(/\/cid\/(\d+)/);
        if (cidMatch) console.log(`[AWIN] Feed campaign cid=${cidMatch[1]}`);
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

        console.log("🕷 [STEP 2] Running missing Reifen data scraper...");
        const scraper = spawn("node", ["src/api/utils/scrapeMissingReifenData.js"], {
            stdio: "inherit",
        });

        await new Promise((resolve) => scraper.on("close", resolve));
        console.log("✅ [STEP 2] Scraper finished successfully.");

        setTimeout(() => {
            fs.unlink(tmpPath, (err) => {
                if (err)
                    console.error("[CLEANUP] Failed to delete temp CSV:", err.message);
                else console.log("[CLEANUP] Temp CSV deleted:", tmpPath);
            });
        }, 10000);

        console.log("🎉 [CRON] AWIN import + scraper cycle completed.");
    } catch (err) {
        console.error("[CRON ERROR]", err.message);
        setTimeout(attemptCsvImport, RETRY_DELAY_MS);
    } finally {
        isRunning = false;
        console.log("[CRON] 🔓 Import cycle complete — ready for next run.");
    }
}

await connectDB();

attemptCsvImport();

cron.schedule("*/5 * * * *", async () => {
    if (isRunning) {
        console.log("[CRON] ⏳ Still running — skipping this tick.");
        return;
    }
    console.log("[CRON] 🕒 Checking AWIN import schedule...");
    await attemptCsvImport();
});

console.log("[CRON] ✅ Scheduled AWIN import + scraper every 5 min (3h cooldown).");
