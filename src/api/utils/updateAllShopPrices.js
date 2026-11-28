// Updates the price of every offer on every product (the full catalog).
//
// Each product has several vendor offers. This opens each vendor's product
// page, reads the selling price, and writes it. reifen.com is included.
// giga-reifen.de is not: that shop blocks the request (npm run giga:sync).
//
//   node src/api/utils/updateAllShopPrices.js
//   npm run prices:all
//
// npm run cron runs this as the last step of every AWIN import, and the
// price cycle runs it last as well. A second copy exits if one is already
// walking the catalog.
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mongoose from "mongoose";
import ImportMeta from "../../models/ImportMeta.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = "SHOP_PRICES";
const STALE_MS = Number(process.env.SHOP_PRICES_STALE_HOURS || 6) * 3600 * 1000;
const REFRESH = path.join(__dirname, "refreshPricesFromMerchants.js");

function runRefresh() {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, [REFRESH], {
            stdio: "inherit",
            env: { ...process.env, PRICE_REFRESH_INCLUDE_REIFEN: "true" },
        });
        child.on("error", (err) => {
            console.error("[SHOP-PRICES]", err?.message || err);
            resolve(1);
        });
        child.on("exit", (code) => resolve(code ?? 1));
    });
}

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const meta = await ImportMeta.findOne({ source: SOURCE }).lean().catch(() => null);
    const beat = meta?.heartbeatAt ? new Date(meta.heartbeatAt).getTime() : 0;
    if (meta?.isRunning && beat && Date.now() - beat < STALE_MS) {
        console.log("[SHOP-PRICES] Full catalog update already running — not starting a second one.");
        await mongoose.disconnect();
        return;
    }

    const started = new Date();
    console.log(`\n[SHOP-PRICES] Updating every vendor price on every product @ ${started.toISOString()}`);
    await ImportMeta.updateOne(
        { source: SOURCE },
        { $set: { isRunning: true, lastStarted: started, heartbeatAt: started, done: false } },
        { upsert: true }
    );

    const pulse = setInterval(() => {
        ImportMeta.updateOne({ source: SOURCE }, { $set: { heartbeatAt: new Date() } }).catch(() => {});
    }, 60 * 1000);

    let code = 1;
    try {
        code = await runRefresh();
    } finally {
        clearInterval(pulse);
        const ok = code === 0;
        await ImportMeta.updateOne(
            { source: SOURCE },
            {
                $set: {
                    isRunning: false,
                    done: ok,
                    heartbeatAt: new Date(),
                    ...(ok ? { lastSuccess: new Date() } : { lastError: `exit ${code}`, lastErrorAt: new Date() }),
                },
            }
        ).catch(() => {});
        const min = ((Date.now() - started.getTime()) / 60000).toFixed(0);
        console.log(`[SHOP-PRICES] Full catalog ${ok ? "finished" : "failed"} in ${min} min.`);
        await mongoose.disconnect().catch(() => {});
    }
    process.exit(code === 0 ? 0 : 1);
}

main().catch(async (err) => {
    console.error("[SHOP-PRICES]", err?.message || err);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
});
