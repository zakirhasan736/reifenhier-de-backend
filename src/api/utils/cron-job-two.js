// src/api/utils/cron-job.js
// Sequential job loop (no overlap) with fixed delay AFTER completion.
// Order matters: put the availability check first, then the price updater.

import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Config (env overrides) ──────────────────────────────────────────────
const INTERVAL_MIN = Number(process.env.CRON_INTERVAL_MINUTES || 1440); // daily merchant price check
const CONTINUE_ON_ERROR = process.env.CRON_CONTINUE_ON_ERROR === "1";

// List your scripts in execution order. You can override with CRON_JOBS env
// (comma-separated relative or absolute paths).
const DEFAULT_JOBS = [
    // 1) AWIN feed prices (same search_price shown on site and sent to vendor)
    path.join(__dirname, "updatePricesIncremental.js"),
    // 2) Check availability & prune vendors/products
    path.join(__dirname, "purgeUnavailableOffers.js"),
    // 3) Verify & refresh prices against merchant pages
    path.join(__dirname, "refreshPricesFromMerchants.js"),
];

const JOBS = (process.env.CRON_JOBS || DEFAULT_JOBS.join(","))
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

// ── Core runner ─────────────────────────────────────────────────────────
let running = false;

function runJob(file) {
    return new Promise((resolve) => {
        const startedAt = new Date();
        const pretty = path.isAbsolute(file) ? file : path.relative(process.cwd(), file);
        console.log(`\n▶️  [JOB START] ${pretty} @ ${startedAt.toISOString()}`);

        // Spawn as a separate Node process so each script controls its own memory/DB lifecycle
        const child = spawn(process.execPath, [file], {
            stdio: "inherit", // stream child logs (so you see your status lines)
            env: process.env,
        });

        child.on("error", (err) => {
            console.error(`❌  [JOB ERROR] ${pretty}:`, err?.message || err);
            resolve({ ok: false, code: -1, file, startedAt, endedAt: new Date() });
        });

        child.on("exit", (code, signal) => {
            const endedAt = new Date();
            if (code === 0) {
                console.log(`✅  [JOB DONE]  ${pretty} (exit 0) in ${((endedAt - startedAt) / 1000).toFixed(1)}s`);
                resolve({ ok: true, code, file, startedAt, endedAt });
            } else {
                console.error(`❌  [JOB FAIL]  ${pretty} (code ${code}${signal ? `, signal ${signal}` : ""})`);
                resolve({ ok: false, code, file, startedAt, endedAt });
            }
        });
    });
}

async function runCycle() {
    if (running) {
        console.log("⏭️  Previous cycle still running — skipping trigger.");
        return;
    }
    running = true;

    console.log(`\n⏱️  Cycle started @ ${new Date().toISOString()}`);
    let allOk = true;

    for (const job of JOBS) {
        const file = path.isAbsolute(job) ? job : path.resolve(process.cwd(), job);
        const res = await runJob(file);
        if (!res.ok && !CONTINUE_ON_ERROR) {
            allOk = false;
            console.error("🛑  Stopping cycle due to job failure.");
            break;
        }
    }

    console.log(`🏁 Cycle finished @ ${new Date().toISOString()} — status: ${allOk ? "OK" : "FAILED"}`);
    running = false;
}

// Kick off daily at 05:15 (after overnight AWIN imports)
cron.schedule("15 5 * * *", () => {
    console.log("[CRON] Daily AWIN price + merchant verification cycle.");
    runCycle();
});
console.log("[CRON] Daily price/lookup jobs scheduled at 05:15.");

// Optional: clean shutdown messages (PM2 will handle restarts)
process.on("SIGINT", () => {
    console.log("\n🛑 Orchestrator interrupted (SIGINT).");
    process.exit(0);
});
process.on("SIGTERM", () => {
    console.log("\n🛑 Orchestrator terminated (SIGTERM).");
    process.exit(0);
});
