
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import { findLogo } from "../utils/logoFinder.js";
import { VENDOR_PAYMENT_ICONS } from "../utils/vendorPaymentIcons.js";
import isEqual from "lodash.isequal";
// import { spawn } from "child_process";
import {
    isCarTyreGroup,
    isValidVendor
} from "../utils/validators.js";


dotenv.config();

const LiveProduct = mongoose.model("Product", Product.schema, "products");

let importStatus = {
    running: false,
    done: false,
    progress: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    deleted: 0,
    error: null,
    startedAt: null,
    finishedAt: null,
    filename: "",
    debugLog: [],
    skipReasons: {
        invalidSecondCategory: 0,
        missingThirdCategory: 0,
        missingEAN: 0,
    },
    vendors: [],
};

// --- Utility Functions ---
function normalizeEAN(ean) {
    if (!ean || typeof ean !== "string") return "";
    return ean.trim().replace(/^0+/, "");
}
function parseSafeNumber(val) {
    if (!val || typeof val === 'undefined' || val === '' || val === 'NaN') return undefined;
    const normalized = String(val).replace(',', '.').trim();
    const num = parseFloat(normalized);
    return isNaN(num) ? undefined : num;
}
function parseTyreDimensions(dim) {
    if (!dim) return { width: "", height: "", diameter: "" };
    const parts = dim.match(/\d+/g) || [];
    return { width: parts[0] || "", height: parts[1] || "", diameter: parts[2] || "" };
}
function extractIndexesFromProductName(name) {
    const rIdx = name ? name.search(/\bR\d+/i) : -1;
    if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
    const tail = name.substring(rIdx + 2);
    const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
    return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
}
function stripIgnoredFields(obj) {
    const { _id, __v, createdAt, updatedAt, last_imported_at, ...rest } = obj || {};
    return rest;
}
function normalizeField(val) {
    if (typeof val === "string") return val.trim().toLowerCase();
    if (typeof val === "number") return Number(val);
    return val;
}
function sortOffersByVendorId(offers) {
    return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
}
function hasNewVendorId(existingOffers = [], newOffers = []) {
    const existingIds = existingOffers.map(o => o.vendor_id);
    return newOffers.some(o => !existingIds.includes(o.vendor_id));
}
const COMPARE_FIELDS = [
    "ean", "gtin", "upc", "aw_product_id", "merchant_product_id",
    "product_name", "brand_name", "product_image", "description",
    "product_url", "merchant_deep_link", "delivery_time",
    "main_price", "product_short_description", "specifications", "condition",
    "product_model", "dimensions", "keywords", "promotional_text",
    "product_type", "commission_group", "category_name", "category_id",
    "merchant_product_category_path", "currency",
    "merchant_product_second_category", "merchant_product_third_category",
    "in_stock", "stock_quantity", "delivery_cost", "mpn",
];

function findChangedFields(existing, incoming) {
    const changed = [];
    const a = stripIgnoredFields(existing);
    const b = stripIgnoredFields(incoming);
    for (const key of COMPARE_FIELDS) {
        if (typeof b[key] === "object") continue;
        if (normalizeField(a[key]) !== normalizeField(b[key])) {
            changed.push(key);
        }
    }
    return changed;
}

function getProductKey(row) {
    return normalizeEAN(row["ean"]);
}
function groupRowsByProductKey(rows) {
    const grouped = {};
    for (const row of rows) {
        const key = getProductKey(row);
        if (!key) continue;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
    }
    return grouped;
}


function getVendorSavings(offers) {
    // Defensive: Ensure offers is always an array
    if (!Array.isArray(offers)) offers = [];
    const prices = offers.map(o => o.price).filter(p => typeof p === "number" && !isNaN(p) && p > 0);
    if (!prices.length) return { savings_amount: 0, savings_percent: "0%" };
    const min = Math.min(...prices), max = Math.max(...prices);
    const savings_amount = max > min ? +(max - min).toFixed(2) : 0;
    const savings_percent = (max > min) ? `-${Math.round(((max - min) / max) * 100)}%` : "0%";
    return { savings_amount, savings_percent };
}

// --- Main Import Logic ---
export function startCsvImportAsync(filePath) {
    importStatus = {
        ...importStatus,
        running: true,
        done: false,
        progress: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        deleted: 0,
        error: null,
        startedAt: new Date(),
        finishedAt: null,
        filename: filePath,
        debugLog: [],
        vendors: [],
    };

    importAWINCsv(filePath)
        .catch(err => {
            importStatus.error = err.message || String(err);
        })
        .finally(() => {
            importStatus.running = false;
            importStatus.done = true;
            importStatus.finishedAt = new Date();
        });
}



const BATCH_SIZE = 1000;



export function getImportProgress(req, res) {
    res.json({
        ...importStatus,
        batchSize: BATCH_SIZE
    });
}
const cloudinaryUploadQueue = new Set();
export async function importAWINCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        const vendorsFound = new Set();
        let rowCount = 0;
        let totalLines = 0;
        try {
            totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
        } catch (err) {
            totalLines = 0;
        }
        importStatus.total = totalLines;

        fs.createReadStream(filePath)
            .pipe(csv({ separator: ";" }))
            .on("data", (row) => {
                rowCount++;
                importStatus.progress = Math.round((rowCount / (importStatus.total || 1)) * 100);

                if (row["merchant_name"]) vendorsFound.add(row["merchant_name"].trim());

                if (!isValidVendor(row)) return;
                const groupKey = normalizeEAN(row["ean"]);
                if (!groupKey) {
                    importStatus.skipReasons.missingEAN++;
                    importStatus.skipped++;
                    return;
                }

                row["search_price"] = parseSafeNumber(row["search_price"]);
                row["store_price"] = parseSafeNumber(row["store_price"]);
                row["rrp_price"] = parseSafeNumber(row["rrp_price"]);

                rows.push(row);
            })
            .on("end", async () => {
                importStatus.vendors = Array.from(vendorsFound).sort();
                const grouped = groupRowsByProductKey(rows);

                const groupKeys = Object.keys(grouped);
                for (let i = 0; i < groupKeys.length; i += BATCH_SIZE) {
                    const batchKeys = groupKeys.slice(i, i + BATCH_SIZE);
                    const products = {};

                    for (const groupKey of batchKeys) {
                        const vendorRows = grouped[groupKey];

                        if (!isCarTyreGroup(vendorRows)) {
                            importStatus.skipped++;
                            importStatus.debugLog.push(`[SKIP] ${groupKey} - No valid Reifen.com car tyre`);
                            continue;
                        }

                        let masterRow = vendorRows.find(r => (r["merchant_name"] || "").trim().toLowerCase() === "reifen.com");
                        if (!masterRow) masterRow = vendorRows[0];
                        const vendorPrices = vendorRows
                            .map(r => parseSafeNumber(r["search_price"]))
                            .filter(p => typeof p === "number" && !isNaN(p) && p > 0);

                        const maxPrice = vendorPrices.length > 0 ? Math.max(...vendorPrices) : 0;

                        const offers = vendorRows.map(row => {
                            const vendorPrice = parseSafeNumber(row["search_price"]);
                            const isValidPrice = typeof vendorPrice === "number" && !isNaN(vendorPrice) && vendorPrice > 0;

                            const savingsAmount = isValidPrice && maxPrice > vendorPrice
                                ? +(maxPrice - vendorPrice).toFixed(2)
                                : 0;

                            const savingsPercent = isValidPrice && maxPrice > vendorPrice && maxPrice > 0
                                ? `-${Math.round(((maxPrice - vendorPrice) / maxPrice) * 100)}%`
                                : "0%";

                            return {
                                vendor: row["merchant_name"],
                                vendor_id: row["merchant_id"],
                                brand_name: row["brand_name"],
                                product_name: row["product_name"],
                                vendor_logo: findLogo("vendors", row["merchant_name"]),
                                price: isValidPrice ? vendorPrice : 0,
                                savings_amount: savingsAmount,
                                savings_percent: savingsPercent,
                                currency: row["currency"],
                                payment_icons: VENDOR_PAYMENT_ICONS[row["merchant_name"]] || [],
                                aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
                                original_affiliate_url: row["aw_deep_link"],
                                delivery_cost: row["delivery_cost"],
                                delivery_time: row["delivery_time"],
                                product_category: row["merchant_product_third_category"],
                                merchant_deep_link: row["merchant_deep_link"],
                                in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
                            };
                        });

                        const { width, height, diameter } = parseTyreDimensions(masterRow["dimensions"]);
                        const { speedIndex, lastIndex } = extractIndexesFromProductName(masterRow["product_name"]);
                        const prices = offers.map(o => o.price).filter(p => p > 0);
                        const cheapest = Math.min(...prices);
                        const mostExpensive = Math.max(...prices);
                        const cheapestVendorOffer = offers.find(o => o.price === cheapest);
                        const savings = getVendorSavings(offers);

                        products[groupKey] = {
                            ean: normalizeEAN(masterRow["ean"]),
                            gtin: masterRow["gtin"],
                            upc: masterRow["upc"],
                            aw_product_id: masterRow["aw_product_id"],
                            merchant_product_id: masterRow["merchant_product_id"],
                            product_name: masterRow["product_name"],
                            brand_name: masterRow["brand_name"],
                            brand_logo: findLogo("brands", masterRow["brand_name"]),
                            category_name: masterRow["category_name"],
                            category_id: masterRow["category_id"],
                            product_image: masterRow["merchant_image_url"] || masterRow["aw_image_url"] || masterRow["aw_thumb_url"] || masterRow["large_image"] || masterRow["alternate_image"] || masterRow["alternate_image_two"] || masterRow["alternate_image_three"] || masterRow["alternate_image_four"],
                            description: masterRow["description"],
                            product_affiliate_url: masterRow["aw_deep_link"],
                            product_url: cheapestVendorOffer ? cheapestVendorOffer.original_affiliate_url : masterRow["aw_deep_link"],
                            currency: masterRow["currency"],
                            vendor: masterRow["merchant_name"],
                            merchant_deep_link: masterRow["merchant_deep_link"],
                            delivery_time: masterRow["delivery_time"],
                            delivery_cost: cheapestVendorOffer ? cheapestVendorOffer.delivery_cost : masterRow["delivery_cost"],
                            offers,
                            savings_percent: savings.savings_percent,
                            savings_amount: savings.savings_amount,
                            total_offers: offers.length,
                            store_price: parseSafeNumber(masterRow["store_price"]),
                            main_price: parseSafeNumber(masterRow["search_price"]),
                            rrp_price: parseSafeNumber(masterRow["rrp_price"]),
                            search_price: cheapest,
                            cheapest_offer: cheapest,
                            expensive_offer: mostExpensive,
                            payment_methods: cheapestVendorOffer ? cheapestVendorOffer.payment_icons : [],
                            cheapest_vendor: cheapestVendorOffer ? {
                                vendor: cheapestVendorOffer.vendor,
                                vendor_id: cheapestVendorOffer.vendor_id,
                                vendor_logo: cheapestVendorOffer.vendor_logo,
                                aw_deep_link: cheapestVendorOffer.original_affiliate_url,
                                payment_icons: cheapestVendorOffer.payment_icons,
                                delivery_cost: cheapestVendorOffer.delivery_cost
                            } : null,
                            colour: masterRow["colour"],
                            product_short_description: masterRow["product_short_description"],
                            specifications: masterRow["specifications"],
                            condition: masterRow["condition"],
                            product_model: masterRow["product_model"],
                            dimensions: masterRow["dimensions"],
                            keywords: masterRow["keywords"],
                            promotional_text: masterRow["promotional_text"],
                            product_type: masterRow["product_type"],
                            commission_group: masterRow["commission_group"],
                            merchant_product_category_path: masterRow["merchant_product_category_path"],
                            merchant_product_second_category: masterRow["merchant_product_second_category"],
                            merchant_product_third_category: masterRow["merchant_product_third_category"],
                            last_updated: masterRow["last_updated"],
                            in_stock: masterRow["in_stock"] === "1" || masterRow["in_stock"] === 1 || masterRow["in_stock"] === 1.0,
                            stock_quantity: masterRow["stock_quantity"],
                            noise_class: masterRow["custom_1"],
                            wet_grip: masterRow["custom_2"],
                            fuel_class: masterRow["custom_3"],
                            delivery_cost: masterRow["delivery_cost"],
                            mpn: masterRow["mpn"],
                            width,
                            height,
                            diameter,
                            speedIndex,
                            lastIndex,
                            last_imported_at: new Date(),
                            group_key: groupKey
                        };
                    }
                    // console.log(`✔️ Cloudinary upload complete: ${cloudUploadCount} / ${totalToUpload} products uploaded to Cloudinary.`);
                    const csvEanList = Object.keys(products);
                    const allDbProducts = await LiveProduct.find({ ean: { $in: csvEanList } }).lean();
                    const dbEanToProduct = {};
                    allDbProducts.forEach(prod => {
                        if (prod.ean) dbEanToProduct[normalizeEAN(prod.ean)] = prod;
                    });
                  
                    const bulkOps = [];
                    for (const ean of csvEanList) {
                        const newProd = products[ean];
                        const existing = dbEanToProduct[ean];
                        const prices = newProd.offers.map(o => o.price).filter(p => typeof p === "number" && !isNaN(p) && p > 0);
                        const cheapest_offer = prices.length ? Math.min(...prices) : 0;
                        const expensive_offer = prices.length ? Math.max(...prices) : 0;
                        const savings_amount = expensive_offer > cheapest_offer ? +(expensive_offer - cheapest_offer).toFixed(2) : 0;
                        const savings_percent = (expensive_offer > cheapest_offer) ? `-${Math.round(((expensive_offer - cheapest_offer) / expensive_offer) * 100)}%` : "0%";

                        newProd.cheapest_offer = cheapest_offer;
                        newProd.expensive_offer = expensive_offer;
                        newProd.savings_amount = savings_amount;
                        newProd.savings_percent = savings_percent;
                        newProd.search_price = cheapest_offer;
                        newProd.cheapest_price_display = cheapest_offer ? `${cheapest_offer.toFixed(2).replace('.', ',')} €` : undefined;
                        newProd.expensive_price_display = expensive_offer ? `${expensive_offer.toFixed(2).replace('.', ',')} €` : undefined;
                        newProd.savings_badge = savings_amount > 0 ? `Spare ${savings_percent}` : undefined;
                        newProd.offer_count_display = newProd.offers.length > 1 ? `${newProd.offers.length} Angebote` : "1 Angebot";

                        if (!existing) {
                            const newProd = products[ean];
                            importStatus.imported++;
                            bulkOps.push({ insertOne: { document: newProd } });
                            importStatus.debugLog.push(`[INSERT] ${ean}`);
                            if (newProd.product_image.includes("reifen.com")) {
                                cloudinaryUploadQueue.add(ean);
                            }
                        } else {
                            newProd.product_image = existing.product_image;
                            const updateProd = { ...newProd, product_image: existing.product_image };
                            const existingOffersSorted = sortOffersByVendorId(existing.offers);
                            const newOffersSorted = sortOffersByVendorId(newProd.offers);
                            const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted, product_image: existing.product_image };
                            const cleanNew = { ...stripIgnoredFields(updateProd), offers: newOffersSorted, product_image: existing.product_image };

                            if (!isEqual(cleanExisting, cleanNew)) {
                                const reasons = findChangedFields(existing, newProd);
                                if (hasNewVendorId(existing.offers || [], newProd.offers)) reasons.push("new_vendor_id");
                                importStatus.updated++;
                                bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
                                importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
                            } else {
                                importStatus.skipped++;
                            }
                        }
                    }
                    if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);
                }

                const csvEanSet = new Set(Object.keys(grouped));
                const allDbEans = (await LiveProduct.find({}, { ean: 1 })).map(p => normalizeEAN(p.ean)).filter(Boolean);
                const toDeleteEans = allDbEans.filter(dbEan => !csvEanSet.has(dbEan));
                if (toDeleteEans.length > 0) {
                    const deleted = await LiveProduct.deleteMany({ ean: { $in: toDeleteEans } });
                    importStatus.deleted = deleted.deletedCount || 0;
                } else {
                    importStatus.deleted = 0;
                }

                    importStatus.done = true;
                    importStatus.finishedAt = new Date();
                    importStatus.progress = 100;
                
                // console.log(`✅ Import done. Total EAN groups: ${allDbEans.length}, Batches: ${batchCount}, Vendors found: ${[...vendorsFound].join(", ")}`);
                console.log(`✅ Import Summary: New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);

                // only trigger Cloudinary upload if there are new reifen.com images
                // if (cloudinaryUploadQueue.size > 0) {
                //     spawn("node", ["src/api/utils/uploadProductImages.js"], { stdio: "inherit" });
                // }
               
                // // ✅ Trigger competitor updater
                // spawn("node", ["src/api/utils/updateRelatedCheaper.js"], { stdio: "inherit" });
              
                // spawn("node", ["src/api/utils/scrapeMissingReifenData.js"], { stdio: "inherit" });

                resolve();
            })
            .on("error", (err) => {
                importStatus.error = err.message;
                reject(err);
            });
    });
}

export function getVendorsFromLastImport(req, res) {
    res.json({ vendors: importStatus.vendors });

}
export async function getVendorsFromDatabase(req, res) {
    const products = await LiveProduct.find({}, { offers: 1 }).lean();
    const vendors = new Set();
    for (const prod of products) {
        (prod.offers || []).forEach(offer => {
            if (offer.vendor) vendors.add(offer.vendor);
        });
    }
    res.json({ vendors: Array.from(vendors).sort() });
}
// export function getImportProgress(req, res) {
//     res.json(importStatus);
// }
export async function waitForImportToFinish() {
    while (importStatus.running) {
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}
