// src/api/utils/cron-job-two.js
// Price cycle — every PRICE_CYCLE_INTERVAL_HOURS (default 5 h), separate from
// the AWIN product import (cron-job.js, every 3 h).
//
//   1) purgeUnavailableOffers.js     drop offers whose shop page is gone
//   2) refreshPricesFromMerchants.js read the price on each shop's own page and
//                                    show it (AWIN feeds lag the shop)
//   3) syncReifenComPrices.js        reifen.com live prices
//
// Runs one job after another (never in parallel), waits while the full AWIN
// import is writing, and stores its last start in ImportMeta {source:"PRICES"}
// so a pm2 restart does not start it again early (or forget it).

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";
import ImportMeta from "../../models/ImportMeta.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config (env overrides) ──────────────────────────────────────────────
const INTERVAL_H = Number(process.env.PRICE_CYCLE_INTERVAL_HOURS || 5);
const INTERVAL_MS = INTERVAL_H * 3600 * 1000;
// One failing job must not skip the others (was: stop the whole cycle).
const CONTINUE_ON_ERROR = process.env.CRON_CONTINUE_ON_ERROR !== "0";
const SOURCE = "PRICES";

const DEFAULT_JOBS = [
    path.join(__dirname, "purgeUnavailableOffers.js"),
    path.join(__dirname, "refreshPricesFromMerchants.js"),
    ...(String(process.env.REIFEN_SYNC_ENABLED ?? "true") === "true" ? [path.join(__dirname, "syncReifenComPrices.js")] : []),
    // The AWIN feed prices themselves come with the 3-hourly full import. Set
    // PRICE_CYCLE_INCLUDE_FEED=1 to also run the quick AWIN price update here.
    ...(process.env.PRICE_CYCLE_INCLUDE_FEED === "1" ? [path.join(__dirname, "updatePricesIncremental.js")] : []),
];

const JOBS = (process.env.CRON_JOBS || DEFAULT_JOBS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Price jobs rewrite offers — never run them while the full AWIN import writes. */
async function waitForFullImportIdle(maxMinutes = 180) {
    const until = Date.now() + maxMinutes * 60000;
    while (Date.now() < until) {
        const meta = await ImportMeta.findOne({ source: "AWIN" }).lean().catch(() => null);
        if (!meta?.isRunning) return true;
        console.log("[PRICES] ⏳ Full AWIN import running — price job waiting...");
        await new Promise((r) => setTimeout(r, 60000));
    }
    return false;
}

function runJob(file) {
    return new Promise((resolve) => {
        const startedAt = new Date();
        const pretty = path.isAbsolute(file) ? path.relative(process.cwd(), file) : file;
        console.log(`\n▶️  [PRICES] ${pretty} started @ ${startedAt.toISOString()}`);
        const child = spawn(process.execPath, [file], { stdio: "inherit", env: process.env });
        child.on("error", (err) => {
            console.error(`❌  [PRICES] ${pretty}:`, err?.message || err);
            resolve({ ok: false, file: pretty });
        });
        child.on("exit", (code, signal) => {
            const sec = ((Date.now() - startedAt) / 1000).toFixed(0);
            if (code === 0) console.log(`✅  [PRICES] ${pretty} done in ${sec}s`);
            else console.error(`❌  [PRICES] ${pretty} failed (code ${code}${signal ? `, ${signal}` : ""}) after ${sec}s`);
            resolve({ ok: code === 0, file: pretty });
        });
    });
}

let running = false;

async function runCycle(reason = "schedule") {
    if (running) {
        console.log("[PRICES] ⏭️  Previous price cycle still running — skipping.");
        return;
    }
    running = true;
    const started = new Date();
    console.log(`\n⏱️  [PRICES] Cycle started (${reason}) @ ${started.toISOString()}`);
    await ImportMeta.updateOne(
        { source: SOURCE },
        { $set: { isRunning: true, lastStarted: started, heartbeatAt: started } },
        { upsert: true }
    ).catch(() => {});

    const failed = [];
    try {
        for (const job of JOBS) {
            const file = path.isAbsolute(job) ? job : path.resolve(process.cwd(), job);
            if (!(await waitForFullImportIdle())) {
                failed.push("(full import still running after 3 h — rest skipped)");
                break;
            }
            await ImportMeta.updateOne({ source: SOURCE }, { $set: { heartbeatAt: new Date() } }).catch(() => {});
            const res = await runJob(file);
            if (!res.ok) {
                failed.push(res.file);
                if (!CONTINUE_ON_ERROR) break;
            }
        }
    } finally {
        const ok = failed.length === 0;
        await ImportMeta.updateOne(
            { source: SOURCE },
            {
                $set: {
                    isRunning: false,
                    done: ok,
                    ...(ok ? { lastSuccess: new Date() } : { lastError: `failed: ${failed.join(", ")}`, lastErrorAt: new Date() }),
                },
            }
        ).catch(() => {});
        const min = ((Date.now() - started) / 60000).toFixed(0);
        console.log(`🏁 [PRICES] Cycle finished in ${min} min — ${ok ? "OK" : `with errors: ${failed.join(", ")}`}`);
        console.log(`[PRICES] Next price cycle ~${new Date(started.getTime() + INTERVAL_MS).toISOString()}`);
        running = false;
    }
}

/** Every 10 min: start a cycle once INTERVAL_H has passed since the last start. */
async function checkSchedule() {
    if (running) return;
    const meta = await ImportMeta.findOne({ source: SOURCE }).lean().catch(() => null);
    const last = meta?.lastStarted ? new Date(meta.lastStarted).getTime() : 0;
    if (Date.now() - last >= INTERVAL_MS) runCycle(last ? "every " + INTERVAL_H + " h" : "first run");
}

if (process.env.PRICE_CYCLE_ENABLED === "false") {
    console.log("[PRICES] Price cycle disabled (PRICE_CYCLE_ENABLED=false).");
} else {
    // Only this pm2 process runs price cycles, so a "running" flag left from
    // before a restart is stale. First check 2 min after start, then every 10 min.
    setTimeout(async () => {
        await ImportMeta.updateOne({ source: SOURCE, isRunning: true }, { $set: { isRunning: false } }).catch(() => {});
        checkSchedule().catch((e) => console.error("[PRICES]", e.message));
    }, 2 * 60 * 1000);
    cron.schedule("*/10 * * * *", () => checkSchedule().catch((e) => console.error("[PRICES]", e.message)));
    console.log(`[PRICES] ✅ Price cycle every ${INTERVAL_H} h: ${JOBS.map((j) => path.basename(j)).join(" → ")}`);
}

process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));
