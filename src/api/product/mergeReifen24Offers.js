// version script 3.0.0 — mergeReifen24Offers.js
import fetch from "node-fetch";
import csv from "csv-parser";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import { findLogo } from "../utils/logoFinder.js";

const LiveProduct = mongoose.model("Product", Product.schema, "products");

// --- Helper to normalize EAN ---
function normalizeEAN(ean) {
    if (!ean || typeof ean !== "string") return "";
    return ean.trim().replace(/^0+/, "");
}

export async function mergeOldReifen24Offers(oldCsvUrl) {
    console.log("📦 [MERGE] Starting Reifen24 merge operation...");

    // --- Step 1: Load the old Reifen24 offers ---
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

    console.log(`✅ [MERGE] Loaded ${Object.keys(offersByEan).length} Reifen24 EANs from old feed.`);

    // --- Step 2: Apply Reifen24 offers to DB ---
    const eanList = Object.keys(offersByEan);
    let mergedCount = 0;
    let skipped = 0;

    for (const ean of eanList) {
        const newOffers = offersByEan[ean];
        const product = await LiveProduct.findOne({ ean });

        if (!product) {
            skipped++;
            continue;
        }

        const alreadyExists = (product.offers || []).some((o) =>
            o.vendor?.toLowerCase().includes("reifen24")
        );

        if (alreadyExists) {
            console.log(`ℹ️ [MERGE] Reifen24 offer already exists for ${ean}, skipping.`);
            skipped++;
            continue;
        }

        console.log(`🧩 [MERGE] Adding Reifen24 offer(s) for EAN ${ean}`);
        product.offers.push(...newOffers);
        product.total_offers = product.offers.length;
        await product.save();
        mergedCount++;
    }

    console.log(`🎉 [MERGE COMPLETE] Added Reifen24 offers to ${mergedCount} products. Skipped ${skipped}.`);
}
