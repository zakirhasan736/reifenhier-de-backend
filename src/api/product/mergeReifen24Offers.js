// version script 3.1.0 — mergeReifen24Offers.js (batched merge for performance)
import fetch from "node-fetch";
import csv from "csv-parser";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import { findLogo } from "../utils/logoFinder.js";

const LiveProduct = mongoose.model("Product", Product.schema, "products");

function normalizeEAN(ean) {
    if (!ean || typeof ean !== "string") return "";
    return ean.trim().replace(/^0+/, "");
}

const BATCH_SIZE = 30; // you can tune this to 500–2000 depending on memory

export async function mergeOldReifen24Offers(oldCsvUrl) {
    console.log("📦 [MERGE] Starting Reifen24 merge operation (batched)...");

    // --- Step 1: Load offers from CSV into memory ---
    const offersByEan = {};
    await new Promise((resolve, reject) => {
        fetch(oldCsvUrl)
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to fetch old Reifen24 CSV`);
                res.body
                    .pipe(csv({ separator: ";" }))
                    .on("data", (row) => {
                        const ean = normalizeEAN(row["ean"]);
                        const vendor = (row["merchant_name"] || "").trim().toLowerCase();
                        if (!ean || !vendor.includes("reifen24")) return;

                        const vendorPrice = parseFloat(String(row["search_price"]).replace(",", "."));
                        const offer = {
                            aw_product_id: row["aw_product_id"],
                            vendor: row["merchant_name"],
                            vendor_id: row["merchant_id"],
                            brand_name: row["brand_name"],
                            product_name: row["product_name"],
                            vendor_logo: findLogo("vendors", row["merchant_name"]),
                            price: isNaN(vendorPrice) ? 0 : vendorPrice,
                            currency: row["currency"],
                            delivery_cost: row["delivery_cost"],
                            delivery_time: row["delivery_time"],
                            aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
                            in_stock: row["in_stock"] === "1" || row["in_stock"] === 1,
                        };

                        if (!offersByEan[ean]) offersByEan[ean] = [];
                        offersByEan[ean].push(offer);
                    })
                    .on("end", resolve)
                    .on("error", reject);
            })
            .catch(reject);
    });

    const allEans = Object.keys(offersByEan);
    const totalEans = allEans.length;
    console.log(`✅ [MERGE] Loaded ${totalEans} Reifen24 EANs from old feed.`);

    // --- Step 2: Batch process merges ---
    let mergedCount = 0;
    let skipped = 0;
    const totalBatches = Math.ceil(totalEans / BATCH_SIZE);

    for (let batch = 0; batch < totalBatches; batch++) {
        const startIndex = batch * BATCH_SIZE;
        const endIndex = Math.min(startIndex + BATCH_SIZE, totalEans);
        const batchEans = allEans.slice(startIndex, endIndex);

        console.log(
            `🧩 [MERGE] Processing batch ${batch + 1}/${totalBatches} (${startIndex + 1}-${endIndex})`
        );

        // Fetch all products for this batch
        const dbProducts = await LiveProduct.find({ ean: { $in: batchEans } });

        const bulkOps = [];

        for (const product of dbProducts) {
            const ean = normalizeEAN(product.ean);
            const newOffers = offersByEan[ean] || [];

            const alreadyExists = (product.offers || []).some((o) =>
                o.vendor?.toLowerCase().includes("reifen24")
            );

            if (alreadyExists) {
                skipped++;
                continue;
            }

            // Merge new offers
            product.offers.push(...newOffers);
            product.total_offers = product.offers.length;

            bulkOps.push({
                updateOne: {
                    filter: { _id: product._id },
                    update: { $set: { offers: product.offers, total_offers: product.total_offers } },
                },
            });
            mergedCount++;
        }

        if (bulkOps.length > 0) {
            await LiveProduct.bulkWrite(bulkOps);
            console.log(
                `✅ [MERGE] Batch ${batch + 1}/${totalBatches} completed — ${bulkOps.length} products updated.`
            );
        } else {
            console.log(`ℹ️ [MERGE] Batch ${batch + 1}/${totalBatches} — no new offers added.`);
        }
    }

    console.log(`
🎉 [MERGE COMPLETE]
──────────────────────────
✅ Total merged products: ${mergedCount}
⏭ Skipped (already had Reifen24): ${skipped}
📦 Total EANs processed: ${totalEans}
──────────────────────────
`);
}
