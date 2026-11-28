/**
 * cron-job.js — AWIN CSV import + optional scraper
 * - Downloads AWIN_CSV_URL (ZIP) and imports into MongoDB
 * - Prevents overlapping runs
 * - runs every 3 h (AWIN_IMPORT_INTERVAL_MIN), counted from the last start
 * - last step after every import: updateAllShopPrices.js (every product)
 */

import cron from "node-cron";
import fs from "fs";
import os from "os";
import path from "path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ImportMeta from "../../models/ImportMeta.js";
import Product from "../../models/product.js";
import { importAWINCsv } from "../product/importAWINCsv.js";
import { getLockState, lockState, releaseStaleLock } from "./importLock.js";
import { downloadAwinFeed } from "./awinFeedDownload.js";
import { spawn } from "child_process";

dotenv.config();

const AWIN_CSV_URL = process.env.AWIN_CSV_URL;
const MONGO_URI = process.env.MONGODB_URI;

const RETRY_DELAY_MS = 2 * 60 * 1000;
const SUCCESS_DELAY_MS = Number(process.env.AWIN_IMPORT_INTERVAL_MIN || 180) * 60 * 1000; // 3h between full imports
const MIN_GAP_MS = Number(process.env.AWIN_IMPORT_MIN_GAP_MIN || 30) * 60 * 1000;
let lastWait = 0; // minutes until the next import (logged once an hour, not every 5 min)
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
        console.log("[STEP 2/4] Previous scraper/image/price update still running — skipping this time.");
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
        // Last step of every import: shop-page price of every offer, all products.
        console.log("💶 [STEP 4] Shop prices for the full catalog (last step)...");
        const c3 = await runStep("src/api/utils/updateAllShopPrices.js");
        console.log(`✅ [STEP 4] Shop prices finished (exit ${c3}).`);
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
        const lock = lockState(meta);
        if (lock.alive) {
            console.log(`[CRON] ⏳ Import already running (${lock.progress}%, heartbeat ${lock.heartbeatSecAgo}s ago) — skipping.`);
            return;
        }
        // The process that held the lock is gone (crash, pm2 restart, reboot).
        console.warn(`[CRON] Releasing dead import lock (no heartbeat for ${Math.round(lock.heartbeatSecAgo / 60)} min).`);
        await releaseStaleLock();
    }

    // Every AWIN_IMPORT_INTERVAL_MIN (default 3 h) counted from the START of the
    // last successful import (was: from its end, so a 1 h import meant a 4 h
    // cycle), and at least MIN_GAP after it finished.
    const lastStarted = meta?.lastStarted ? new Date(meta.lastStarted).getTime() : 0;
    const base = lastStarted && lastStarted <= lastSuccess ? lastStarted : lastSuccess;
    const nextAt = Math.max(base + SUCCESS_DELAY_MS, lastSuccess + MIN_GAP_MS);
    if (now < nextAt) {
        lastWait = Math.ceil((nextAt - now) / 60000);
        return;
    }

    isRunning = true;
    lastWait = 0;

    try {
        await removeDuplicateEANs();
        cleanOldFiles();

        console.log("🚀 [STEP 1] Downloading and importing AWIN feed...");
        const cidMatch = AWIN_CSV_URL.match(/\/cid\/(\d+)/);
        if (cidMatch) console.log(`[AWIN] Feed campaign cid=${cidMatch[1]}`);
        // Shop by shop (unchanged shops come from the cache), with retries;
        // falls back to one full download if the AWIN feed list is unavailable.
        const dl = await downloadAwinFeed(AWIN_CSV_URL, { outDir: TEMP_DIR, log: (m) => console.log(m) });
        const tmpPath = dl.file;
        const head = Buffer.alloc(4000);
        const hfd = fs.openSync(tmpPath, "r");
        fs.readSync(hfd, head, 0, 4000, 0);
        fs.closeSync(hfd);
        const headerLine = head.toString("utf8").split(/\r?\n/)[0] || "";
        if (!/aw_deep_link/.test(headerLine) || !/merchant_name/.test(headerLine)) {
            throw new Error(`AWIN feed has unexpected columns (got: ${headerLine.slice(0, 200)})`);
        }
        const mb = (fs.statSync(tmpPath).size / 1024 / 1024).toFixed(1);
        console.log(`[STEP 1] Feed ready (${dl.mode}, ${mb} MB) → ${tmpPath}`);

        // A manual sync may have started while we were downloading.
        const lockNow = await getLockState();
        if (lockNow.alive) {
            console.log("[CRON] ⏳ Another import started during the download — skipping this run.");
            fs.unlink(tmpPath, () => {});
            return;
        }

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

        console.log("🎉 [CRON] AWIN import finished. Scraper, images, then shop prices for every product run as the last step.");
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
    await attemptCsvImport();
    if (!isRunning && lastWait && new Date().getMinutes() < 5) {
        console.log(`[CRON] ⏸ Next AWIN product import in ~${lastWait} min.`);
    }
});

console.log(`[CRON] ✅ AWIN product import (new / updated / deleted products + feed prices) every ${SUCCESS_DELAY_MS / 3600000} h.`);
