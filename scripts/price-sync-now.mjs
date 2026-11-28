#!/usr/bin/env node
/**
 * Update prices NOW (same jobs as the 5-hourly price cycle), or show the schedule.
 *
 *   node scripts/price-sync-now.mjs                 # all price jobs now
 *   node scripts/price-sync-now.mjs --only shops    # every vendor price on every product
 *   node scripts/price-sync-now.mjs --only reifen   # only: reifen.com live prices
 *   node scripts/price-sync-now.mjs --only purge    # only: remove offers whose shop page is gone
 *   node scripts/price-sync-now.mjs --dry-run       # check only, write nothing
 *   node scripts/price-sync-now.mjs --status        # when did / will the import and price cycle run?
 *
 * Waits while the AWIN product import is writing. Refuses to start while the
 * awin-cron price cycle is already running (exit code 3). A full run counts as
 * the scheduled one: the next automatic price cycle comes 5 h later.
 */
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ImportMeta from "../src/models/ImportMeta.js";
import Product from "../src/models/product.js";

dotenv.config();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const only = has("--only") ? String(args[args.indexOf("--only") + 1] || "") : "";
const DRY = has("--dry-run");

const IMPORT_H = Number(process.env.AWIN_IMPORT_INTERVAL_MIN || 180) / 60;
const PRICE_H = Number(process.env.PRICE_CYCLE_INTERVAL_HOURS || 5);

const JOBS = {
    purge: "src/api/utils/purgeUnavailableOffers.js",
    shops: "src/api/utils/updateAllShopPrices.js",
    reifen: "src/api/utils/syncReifenComPrices.js",
};

const fmt = (d) => (d ? new Date(d).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "–");
const ago = (d) => {
    if (!d) return "";
    const m = Math.round((Date.now() - new Date(d).getTime()) / 60000);
    return m < 0 ? `in ${Math.round(-m / 6) / 10} h` : m < 90 ? `${m} min ago` : `${Math.round(m / 6) / 10} h ago`;
};

async function status() {
    const [awin, prices] = await Promise.all([
        ImportMeta.findOne({ source: "AWIN" }).lean(),
        ImportMeta.findOne({ source: "PRICES" }).lean(),
    ]);
    const nextImport = awin?.lastStarted
        ? new Date(Math.max(new Date(awin.lastStarted).getTime() + IMPORT_H * 3600e3, Date.now()))
        : null;
    const nextPrices = prices?.lastStarted
        ? new Date(Math.max(new Date(prices.lastStarted).getTime() + PRICE_H * 3600e3, Date.now()))
        : null;

    const live = await Product.aggregate([
        { $unwind: "$offers" },
        {
            $group: {
                _id: null,
                offers: { $sum: 1 },
                shopPage: { $sum: { $cond: [{ $eq: ["$offers.price_source", "merchant-live"] }, 1, 0] } },
                reifenLive: { $sum: { $cond: [{ $eq: ["$offers.price_source", "reifen.com-live"] }, 1, 0] } },
                checked6h: {
                    $sum: { $cond: [{ $gte: ["$offers.merchant_price_checked_at", new Date(Date.now() - 6 * 3600e3)] }, 1, 0] },
                },
                mismatch: { $sum: { $cond: [{ $eq: ["$offers.price_mismatch", true] }, 1, 0] } },
            },
        },
    ]);
    const l = live[0] || {};

    console.log(`
AWIN product import (new / updated / deleted products + feed prices) — every ${IMPORT_H} h
  running now:   ${awin?.isRunning ? `yes (${awin.progress || 0} %)` : "no"}
  last start:    ${fmt(awin?.lastStarted)}  ${ago(awin?.lastStarted)}
  last success:  ${fmt(awin?.lastSuccess)}  ${ago(awin?.lastSuccess)}
  last result:   new ${awin?.imported ?? 0}, updated ${awin?.updated ?? 0}, deleted ${awin?.deleted ?? 0}, unchanged ${awin?.skipped ?? 0}
  next import:   ~${fmt(nextImport)}
  ${awin?.lastError ? `last error:    ${awin.lastError} (${fmt(awin.lastErrorAt)})` : ""}
Price cycle (shop pages + reifen.com live prices) — every ${PRICE_H} h
  running now:   ${prices?.isRunning ? "yes" : "no"}
  last start:    ${fmt(prices?.lastStarted)}  ${ago(prices?.lastStarted)}
  last success:  ${fmt(prices?.lastSuccess)}  ${ago(prices?.lastSuccess)}
  next cycle:    ~${prices ? fmt(nextPrices) : "within 10 min of the next awin-cron start"}
  ${prices?.lastError ? `last error:    ${prices.lastError} (${fmt(prices.lastErrorAt)})` : ""}
Offers: ${l.offers ?? 0} — showing shop-page price ${l.shopPage ?? 0}, reifen.com live ${l.reifenLive ?? 0},
        shop page checked in the last 6 h ${l.checked6h ?? 0}, still differ from shop ${l.mismatch ?? 0}
(times: German time)`);
}

function run(file, extraEnv) {
    return new Promise((resolve) => {
        console.log(`\n▶ ${file}`);
        const child = spawn(process.execPath, [path.join(root, file)], {
            cwd: root,
            stdio: "inherit",
            env: { ...process.env, ...extraEnv },
        });
        child.on("exit", (code) => resolve(code === 0));
        child.on("error", () => resolve(false));
    });
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    if (has("--status")) {
        await status();
        await mongoose.disconnect();
        process.exit(0);
    }

    const prices = await ImportMeta.findOne({ source: "PRICES" }).lean();
    if (prices?.isRunning) {
        console.log(`The automatic price cycle is running right now (started ${fmt(prices.lastStarted)}). Not starting a second one.`);
        console.log("Check again later with: node scripts/price-sync-now.mjs --status");
        await mongoose.disconnect();
        process.exit(3);
    }

    // The full catalog script already includes reifen.com. --only reifen
    // still runs the reifen.com-only sync.
    const list = only ? [JOBS[only]].filter(Boolean) : [JOBS.purge, JOBS.shops];
    if (!list.length) {
        console.log(`Unknown --only "${only}". Use: ${Object.keys(JOBS).join(", ")}`);
        process.exit(2);
    }

    for (;;) {
        const awin = await ImportMeta.findOne({ source: "AWIN" }).lean();
        if (!awin?.isRunning) break;
        console.log(`AWIN product import running (${awin.progress || 0} %) — waiting 1 min…`);
        await new Promise((r) => setTimeout(r, 60000));
    }

    const full = !only && !DRY;
    if (full) {
        await ImportMeta.updateOne(
            { source: "PRICES" },
            { $set: { isRunning: true, lastStarted: new Date(), heartbeatAt: new Date() } },
            { upsert: true }
        );
    }
    const env = DRY
        ? { PRICE_REFRESH_DRY_RUN: "true", PURGE_DRY_RUN: "true", REIFEN_SYNC_DRY_RUN: "true" }
        : {};
    const failed = [];
    try {
        for (const f of list) if (!(await run(f, env))) failed.push(path.basename(f));
    } finally {
        if (full) {
            await ImportMeta.updateOne(
                { source: "PRICES" },
                {
                    $set: {
                        isRunning: false,
                        done: !failed.length,
                        ...(failed.length
                            ? { lastError: `manual run failed: ${failed.join(", ")}`, lastErrorAt: new Date() }
                            : { lastSuccess: new Date() }),
                    },
                }
            );
        }
    }
    console.log(failed.length ? `\n⚠ Finished with errors: ${failed.join(", ")}` : `\n✅ Prices updated${DRY ? " (dry run, nothing written)" : ""}.`);
    await status();
    await mongoose.disconnect();
    process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
    console.error("❌", e?.message || e);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
