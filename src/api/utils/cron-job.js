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
import { importAWINCsv } from "../product/importAWINCsv.js";
import zlib from "zlib";
import { spawn } from "child_process";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const MONGO_URI = process.env.MONGODB_URI;

const RETRY_DELAY_MS = 2 * 60 * 1000;
const SUCCESS_DELAY_MS = Number(process.env.AWIN_IMPORT_INTERVAL_MIN || 180) * 60 * 1000; // 3h between full imports
const DOWNLOAD_TIMEOUT_MS = Number(process.env.AWIN_DOWNLOAD_TIMEOUT_MS || 15 * 60 * 1000);
const IMPORT_TIMEOUT_MS = Number(process.env.AWIN_IMPORT_TIMEOUT_MS || 3 * 60 * 60 * 1000);
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

let afterImportRunning = false;
function runStep(script) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [script], { stdio: "inherit" });
        child.on("close", (code) => resolve(code));
        child.on("error", () => resolve(-1));
    });
}
function runAfterImportJobs() {
    if (afterImportRunning) {
        console.log("[STEP 2/3] Previous scraper/image sync still running — skipping this time.");
        return;
    }
    afterImportRunning = true;
    (async () => {
        console.log("🕷 [STEP 2] Missing Reifen data scraper (background)...");
        const c1 = await runStep("src/api/utils/scrapeMissingReifenData.js");
        console.log(`✅ [STEP 2] Scraper finished (exit ${c1}).`);
        console.log("🖼  [STEP 3] Product image sync (background)...");
        const c2 = await runStep("src/api/utils/uploadProductImages.js");
        console.log(`✅ [STEP 3] Image sync finished (exit ${c2}).`);
    })().finally(() => {
        afterImportRunning = false;
    });
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
        // Download with a hard timeout — a hung request used to block the cron forever.
        const ctrl = new AbortController();
        const dlTimer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
        let buffer;
        try {
            const res = await fetch(AWIN_CSV_URL, { signal: ctrl.signal });
            if (!res.ok) throw new Error(`AWIN CSV fetch failed: ${res.status} ${res.statusText}`);
            buffer = Buffer.from(await res.arrayBuffer());
        } finally {
            clearTimeout(dlTimer);
        }

        // AWIN can deliver zip, gzip or plain CSV depending on the feed URL.
        let csvBuffer;
        if (buffer.slice(0, 2).toString() === "PK") {
            const zip = new AdmZip(buffer);
            const csvEntry = zip.getEntries().find((e) => /\.csv$/i.test(e.entryName));
            if (!csvEntry) throw new Error("CSV not found in ZIP");
            csvBuffer = zip.readFile(csvEntry);
        } else if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
            csvBuffer = zlib.gunzipSync(buffer);
        } else {
            csvBuffer = buffer;
        }
        const headerLine = csvBuffer.slice(0, 2000).toString("utf8").split(/\r?\n/)[0] || "";
        if (!/aw_deep_link/.test(headerLine) || !/merchant_name/.test(headerLine)) {
            throw new Error(`AWIN feed has unexpected columns (got: ${headerLine.slice(0, 200)})`);
        }

        const tmpPath = path.join(TEMP_DIR, `awin-${Date.now()}.csv`);
        fs.writeFileSync(tmpPath, csvBuffer);
        const mb = (csvBuffer.length / 1024 / 1024).toFixed(1);
        console.log(`[STEP 1] CSV extracted (${mb} MB) → ${tmpPath}`);

        // Await the import itself (with timeout). Polling the DB flag deadlocked
        // whenever the import crashed before clearing isRunning.
        let importTimer;
        try {
            await Promise.race([
                importAWINCsv(tmpPath),
                new Promise((_, reject) => {
                    importTimer = setTimeout(
                        () => reject(new Error(`AWIN import exceeded ${IMPORT_TIMEOUT_MS / 60000} min`)),
                        IMPORT_TIMEOUT_MS
                    );
                }),
            ]);
        } catch (err) {
            await ImportMeta.updateOne(
                { source: "AWIN" },
                { $set: { isRunning: false, done: false, lastError: String(err?.message || err), lastErrorAt: new Date() } }
            ).catch(() => {});
            throw err;
        } finally {
            clearTimeout(importTimer);
        }
        const finalMeta = await ImportMeta.findOne({ source: "AWIN" }).lean();

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

        // STEP 2+3 (scraper, image sync) are slow and don't affect prices or
        // links, so they run in the background instead of holding up the
        // next import. A still-running chain is never started twice.
        runAfterImportJobs();

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
