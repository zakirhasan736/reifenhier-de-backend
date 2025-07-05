// import fs from "fs";
// import csv from "csv-parser";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import { findLogo } from "../utils/logoFinder.js";
// import {
//     isValidVendor,
//     isValidSecondCategory,
//     isValidThirdCategory,
// } from "../utils/validators.js";
// import isEqual from "lodash.isequal";

// dotenv.config();

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// let importStatus = {
//     running: false,
//     done: false,
//     progress: 0,
//     total: 0,
//     imported: 0,
//     updated: 0,
//     skipped: 0,
//     deleted: 0,
//     error: null,
//     startedAt: null,
//     finishedAt: null,
//     filename: "",
//     skipReasons: {
//         invalidVendor: 0,
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//     },
// };

// export function startCsvImportAsync(filePath) {
//     importStatus = {
//         ...importStatus,
//         running: true,
//         done: false,
//         progress: 0,
//         imported: 0,
//         updated: 0,
//         skipped: 0,
//         deleted: 0,
//         error: null,
//         startedAt: new Date(),
//         finishedAt: null,
//         filename: filePath,
//     };

//     importAWINCsv(filePath)
//         .catch(err => {
//             importStatus.error = err.message || String(err);
//         })
//         .finally(() => {
//             importStatus.running = false;
//             importStatus.done = true;
//             importStatus.finishedAt = new Date();
//         });
// }

// function parseTyreDimensions(dim) {
//     if (!dim) return { width: "", height: "", diameter: "" };
//     const match = dim.match(/^\d+/g);
//     return {
//         width: match?.[0] || "",
//         height: match?.[1] || "",
//         diameter: match?.[2] || "",
//     };
// }

// function extractIndexesFromProductName(name) {
//     const rIdx = name.search(/\bR\d+/i);
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const products = {};
//         let rowCount = 0;
//         const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

//                 if (!isValidVendor(row)) return importStatus.skipReasons.invalidVendor++, importStatus.skipped++;
//                 if (!isValidSecondCategory(row)) return importStatus.skipReasons.invalidSecondCategory++, importStatus.skipped++;
//                 if (!isValidThirdCategory(row)) return importStatus.skipReasons.missingThirdCategory++, importStatus.skipped++;

//                 const ean = row["ean"] || row["aw_product_id"];
//                 if (!ean || ean.trim() === "") return;

//                 const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
//                 const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
//                 const thirdCategory = (row["merchant_product_third_category"] || "").trim();
//                 if (vendor !== "reifencom" || secondCategory !== "reifen" || !thirdCategory.includes("reifen")) return;

//                 const vendorName = row["merchant_name"];
//                 const vendorLogo = findLogo("vendors", vendorName);
//                 const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                 const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                 const offer = {
//                     vendor: vendorName,
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: vendorLogo,
//                     price: parseFloat(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: thirdCategory,
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1",
//                 };

//                 if (!products[ean]) {
//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"] || row["large_image"] || row["alternate_image"] || row["alternate_image_two"] || row["alternate_image_three"] || row["alternate_image_four"],
//                         description: row["description"],
//                         merchant_category: row["merchant_category"],
//                         search_price: row["search_price"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         store_price: row["store_price"],
//                         colour: row["colour"],
//                         vendor: vendorName,
//                         product_short_description: row["product_short_description"],
//                         specifications: row["specifications"],
//                         condition: row["condition"],
//                         product_model: row["product_model"],
//                         dimensions: row["dimensions"],
//                         keywords: row["keywords"],
//                         promotional_text: row["promotional_text"],
//                         product_type: row["product_type"],
//                         commission_group: row["commission_group"],
//                         merchant_product_category_path: row["merchant_product_category_path"],
//                         merchant_product_second_category: row["merchant_product_second_category"],
//                         merchant_product_third_category: row["merchant_product_third_category"],
//                         rrp_price: row["rrp_price"],
//                         saving: row["saving"],
//                         savings_percent: row["savings_percent"],
//                         base_price: row["base_price"],
//                         base_price_amount: row["base_price_amount"],
//                         base_price_text: row["base_price_text"],
//                         product_price_old: row["product_price_old"],
//                         delivery_restrictions: row["delivery_restrictions"],
//                         delivery_weight: row["delivery_weight"],
//                         warranty: row["warranty"],
//                         terms_of_contract: row["terms_of_contract"],
//                         delivery_time: row["delivery_time"],
//                         valid_from: row["valid_from"],
//                         valid_to: row["valid_to"],
//                         is_for_sale: row["is_for_sale"],
//                         web_offer: row["web_offer"],
//                         pre_order: row["pre_order"],
//                         stock_status: row["stock_status"],
//                         size_stock_status: row["size_stock_status"],
//                         size_stock_amount: row["size_stock_amount"],
//                         in_stock: row["in_stock"],
//                         stock_quantity: row["stock_quantity"],
//                         reviews: row["reviews"],
//                         average_rating: row["average_rating"],
//                         rating: row["rating"],
//                         number_available: row["number_available"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         isbn: row["isbn"],
//                         upc: row["upc"],
//                         mpn: row["mpn"],
//                         parent_product_id: row["parent_product_id"],
//                         product_GTIN: row["product_GTIN"],
//                         basket_link: row["basket_link"],
//                         last_updated: row["last_updated"],
//                         merchant_thumb_url: row["merchant_thumb_url"],
//                         large_image: row["large_image"],
//                         alternate_image: row["alternate_image"],
//                         aw_thumb_url: row["aw_thumb_url"],
//                         alternate_image_two: row["alternate_image_two"],
//                         alternate_image_three: row["alternate_image_three"],
//                         alternate_image_four: row["alternate_image_four"],
//                         last_imported_at: new Date(),
//                         offers: [offer],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex
//                     };
//                 } else {
//                     if (!products[ean].offers.some(o => o.vendor_id === offer.vendor_id)) {
//                         products[ean].offers.push(offer);
//                     }
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ vendor: "reifencom", ean: { $in: csvEANs } }).lean();

//                 const bulkOps = [];
//                 for (const ean of csvEANs) {
//                     const newProduct = products[ean];
//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                     } else {
//                         const changed = !isEqual(
//                             { ...existing, _id: undefined, last_imported_at: undefined },
//                             { ...newProduct, _id: undefined, last_imported_at: undefined }
//                         );
//                         if (changed) {
//                             importStatus.updated++;
//                         } else {
//                             importStatus.skipped++;
//                             continue;
//                         }
//                     }

//                     bulkOps.push({
//                         updateOne: {
//                             filter: { ean },
//                             update: { $set: newProduct },
//                             upsert: true
//                         }
//                     });
//                 }

//                 const deleted = await LiveProduct.deleteMany({ vendor: "reifencom", ean: { $nin: csvEANs } });
//                 importStatus.deleted = deleted.deletedCount || 0;

//                 if (bulkOps.length > 0) {
//                     await LiveProduct.bulkWrite(bulkOps);
//                 }

//                 importStatus.progress = 100;
//                 console.log(`✅ Import complete. New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);
//                 resolve();
//             })
//             .on("error", (err) => {
//                 importStatus.error = err.message;
//                 reject(err);
//             });
//     });
// }

// export function getImportProgress(req, res) {
//     res.json(importStatus);
// }

// export async function waitForImportToFinish() {
//     while (importStatus.running) {
//         await new Promise(resolve => setTimeout(resolve, 3000));
//     }
// }
// import fs from "fs";
// import csv from "csv-parser";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import { findLogo } from "../utils/logoFinder.js";
// import {
//     isValidVendor,
//     isValidSecondCategory,
//     isValidThirdCategory,
// } from "../utils/validators.js";
// import isEqual from "lodash.isequal";

// dotenv.config();

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// let importStatus = {
//     running: false,
//     done: false,
//     progress: 0,
//     total: 0,
//     imported: 0,
//     updated: 0,
//     skipped: 0,
//     deleted: 0,
//     error: null,
//     startedAt: null,
//     finishedAt: null,
//     filename: "",
//     skipReasons: {
//         invalidVendor: 0,
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//     },
// };

// export function startCsvImportAsync(filePath) {
//     importStatus = {
//         ...importStatus,
//         running: true,
//         done: false,
//         progress: 0,
//         imported: 0,
//         updated: 0,
//         skipped: 0,
//         deleted: 0,
//         error: null,
//         startedAt: new Date(),
//         finishedAt: null,
//         filename: filePath,
//     };

//     importAWINCsv(filePath)
//         .catch(err => {
//             importStatus.error = err.message || String(err);
//         })
//         .finally(() => {
//             importStatus.running = false;
//             importStatus.done = true;
//             importStatus.finishedAt = new Date();
//         });
// }

// function parseTyreDimensions(dim) {
//     if (!dim) return { width: "", height: "", diameter: "" };
//     const parts = dim.match(/\d+/g) || [];
//     return {
//         width: parts[0] || "",
//         height: parts[1] || "",
//         diameter: parts[2] || "",
//     };
// }

// function extractIndexesFromProductName(name) {
//     const rIdx = name.search(/\bR\d+/i);
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const products = {};
//         let rowCount = 0;
//         const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

//                 if (!isValidVendor(row)) return importStatus.skipReasons.invalidVendor++, importStatus.skipped++;
//                 if (!isValidSecondCategory(row)) return importStatus.skipReasons.invalidSecondCategory++, importStatus.skipped++;
//                 if (!isValidThirdCategory(row)) return importStatus.skipReasons.missingThirdCategory++, importStatus.skipped++;

//                 const ean = row["ean"] || row["aw_product_id"];
//                 if (!ean || ean.trim() === "") return;

//                 const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
//                 const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
//                 const thirdCategory = (row["merchant_product_third_category"] || "").trim().toLowerCase();
//                 if (vendor !== "reifencom" || secondCategory !== "reifen" || !thirdCategory.includes("reifen")) return;

//                 const vendorName = row["merchant_name"];
//                 const vendorLogo = findLogo("vendors", vendorName);
//                 const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                 const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                 const offer = {
//                     vendor: vendorName,
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: vendorLogo,
//                     price: parseFloat(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: thirdCategory,
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1",
//                 };

//                 if (!products[ean]) {
//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"] || row["large_image"] || row["alternate_image"] || row["alternate_image_two"] || row["alternate_image_three"] || row["alternate_image_four"],
//                         description: row["description"],
//                         merchant_category: row["merchant_category"],
//                         search_price: row["search_price"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         store_price: row["store_price"],
//                         colour: row["colour"],
//                         vendor: vendorName,
//                         product_short_description: row["product_short_description"],
//                         specifications: row["specifications"],
//                         condition: row["condition"],
//                         product_model: row["product_model"],
//                         dimensions: row["dimensions"],
//                         keywords: row["keywords"],
//                         promotional_text: row["promotional_text"],
//                         product_type: row["product_type"],
//                         commission_group: row["commission_group"],
//                         merchant_product_category_path: row["merchant_product_category_path"],
//                         merchant_product_second_category: row["merchant_product_second_category"],
//                         merchant_product_third_category: row["merchant_product_third_category"],
//                         rrp_price: row["rrp_price"],
//                         saving: row["saving"],
//                         savings_percent: row["savings_percent"],
//                         base_price: row["base_price"],
//                         base_price_amount: row["base_price_amount"],
//                         base_price_text: row["base_price_text"],
//                         product_price_old: row["product_price_old"],
//                         delivery_restrictions: row["delivery_restrictions"],
//                         delivery_weight: row["delivery_weight"],
//                         warranty: row["warranty"],
//                         terms_of_contract: row["terms_of_contract"],
//                         delivery_time: row["delivery_time"],
//                         valid_from: row["valid_from"],
//                         valid_to: row["valid_to"],
//                         is_for_sale: row["is_for_sale"],
//                         web_offer: row["web_offer"],
//                         pre_order: row["pre_order"],
//                         stock_status: row["stock_status"],
//                         size_stock_status: row["size_stock_status"],
//                         size_stock_amount: row["size_stock_amount"],
//                         in_stock: row["in_stock"],
//                         stock_quantity: row["stock_quantity"],
//                         reviews: row["reviews"],
//                         average_rating: row["average_rating"],
//                         rating: row["rating"],
//                         number_available: row["number_available"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         isbn: row["isbn"],
//                         upc: row["upc"],
//                         mpn: row["mpn"],
//                         parent_product_id: row["parent_product_id"],
//                         product_GTIN: row["product_GTIN"],
//                         basket_link: row["basket_link"],
//                         last_updated: row["last_updated"],
//                         merchant_thumb_url: row["merchant_thumb_url"],
//                         large_image: row["large_image"],
//                         alternate_image: row["alternate_image"],
//                         aw_thumb_url: row["aw_thumb_url"],
//                         alternate_image_two: row["alternate_image_two"],
//                         alternate_image_three: row["alternate_image_three"],
//                         alternate_image_four: row["alternate_image_four"],
//                         last_imported_at: new Date(),
//                         offers: [offer],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex
//                     };
//                 } else {
//                     if (!products[ean].offers.some(o => o.vendor_id === offer.vendor_id)) {
//                         products[ean].offers.push(offer);
//                     }
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ vendor: "reifencom", ean: { $in: csvEANs } }).lean();

//                 const bulkOps = [];

//                 for (const ean of csvEANs) {
//                     const newProduct = products[ean];
//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProduct } });
//                     } else {
//                         const changed = !isEqual(
//                             { ...existing, _id: undefined, last_imported_at: undefined },
//                             { ...newProduct, _id: undefined, last_imported_at: undefined }
//                         );
//                         if (changed) {
//                             importStatus.updated++;
//                             bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProduct } } });
//                         } else {
//                             importStatus.skipped++;
//                         }
//                     }
//                 }

//                 const deleted = await LiveProduct.deleteMany({ vendor: "reifencom", ean: { $nin: csvEANs } });
//                 importStatus.deleted = deleted.deletedCount || 0;

//                 if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);

//                 importStatus.progress = 100;
//                 console.log(`✅ Import complete. New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);
//                 resolve();
//             })
//             .on("error", (err) => {
//                 importStatus.error = err.message;
//                 reject(err);
//             });
//     });
// }

// export function getImportProgress(req, res) {
//     res.json(importStatus);
// }

// export async function waitForImportToFinish() {
//     while (importStatus.running) {
//         await new Promise(resolve => setTimeout(resolve, 3000));
//     }
// }
// import fs from "fs";
// import csv from "csv-parser";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import { findLogo } from "../utils/logoFinder.js";
// import {
//     isValidVendor,
//     isValidSecondCategory,
//     isValidThirdCategory,
// } from "../utils/validators.js";
// import isEqual from "lodash.isequal";

// dotenv.config();

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// let importStatus = {
//     running: false,
//     done: false,
//     progress: 0,
//     total: 0,
//     imported: 0,
//     updated: 0,
//     skipped: 0,
//     deleted: 0,
//     error: null,
//     startedAt: null,
//     finishedAt: null,
//     filename: "",
//     skipReasons: {
//         invalidVendor: 0,
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//     },
// };

// export function startCsvImportAsync(filePath) {
//     importStatus = {
//         ...importStatus,
//         running: true,
//         done: false,
//         progress: 0,
//         imported: 0,
//         updated: 0,
//         skipped: 0,
//         deleted: 0,
//         error: null,
//         startedAt: new Date(),
//         finishedAt: null,
//         filename: filePath,
//     };

//     importAWINCsv(filePath)
//         .catch(err => {
//             importStatus.error = err.message || String(err);
//         })
//         .finally(() => {
//             importStatus.running = false;
//             importStatus.done = true;
//             importStatus.finishedAt = new Date();
//         });
// }

// function parseTyreDimensions(dim) {
//     if (!dim) return { width: "", height: "", diameter: "" };
//     const parts = dim.match(/\d+/g) || [];
//     return {
//         width: parts[0] || "",
//         height: parts[1] || "",
//         diameter: parts[2] || "",
//     };
// }

// function extractIndexesFromProductName(name) {
//     const rIdx = name.search(/\bR\d+/i);
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const products = {};
//         let rowCount = 0;
//         const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

//                 if (!isValidVendor(row)) return importStatus.skipReasons.invalidVendor++, importStatus.skipped++;
//                 if (!isValidSecondCategory(row)) return importStatus.skipReasons.invalidSecondCategory++, importStatus.skipped++;
//                 if (!isValidThirdCategory(row)) return importStatus.skipReasons.missingThirdCategory++, importStatus.skipped++;

//                 const ean = row["ean"]?.trim() || row["aw_product_id"];
//                 if (!ean) return;

//                 const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
//                 const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
//                 const thirdCategory = (row["merchant_product_third_category"] || "").trim().toLowerCase();
//                 if (vendor !== "reifencom" || secondCategory !== "reifen" || !thirdCategory.includes("reifen")) return;

//                 const vendorName = row["merchant_name"];
//                 const vendorLogo = findLogo("vendors", vendorName);
//                 const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                 const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                 const offer = {
//                     vendor: vendorName,
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: vendorLogo,
//                     price: parseFloat(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: thirdCategory,
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1",
//                 };

//                 if (!products[ean]) {
//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"] || row["large_image"] || row["alternate_image"] || row["alternate_image_two"] || row["alternate_image_three"] || row["alternate_image_four"],
//                         description: row["description"],
//                         merchant_category: row["merchant_category"],
//                         search_price: row["search_price"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         store_price: row["store_price"],
//                         colour: row["colour"],
//                         vendor: vendorName,
//                         product_short_description: row["product_short_description"],
//                         specifications: row["specifications"],
//                         condition: row["condition"],
//                         product_model: row["product_model"],
//                         dimensions: row["dimensions"],
//                         keywords: row["keywords"],
//                         promotional_text: row["promotional_text"],
//                         product_type: row["product_type"],
//                         commission_group: row["commission_group"],
//                         merchant_product_category_path: row["merchant_product_category_path"],
//                         merchant_product_second_category: row["merchant_product_second_category"],
//                         merchant_product_third_category: row["merchant_product_third_category"],
//                         rrp_price: row["rrp_price"],
//                         saving: row["saving"],
//                         savings_percent: row["savings_percent"],
//                         base_price: row["base_price"],
//                         base_price_amount: row["base_price_amount"],
//                         base_price_text: row["base_price_text"],
//                         product_price_old: row["product_price_old"],
//                         delivery_restrictions: row["delivery_restrictions"],
//                         delivery_weight: row["delivery_weight"],
//                         warranty: row["warranty"],
//                         terms_of_contract: row["terms_of_contract"],
//                         delivery_time: row["delivery_time"],
//                         valid_from: row["valid_from"],
//                         valid_to: row["valid_to"],
//                         is_for_sale: row["is_for_sale"],
//                         web_offer: row["web_offer"],
//                         pre_order: row["pre_order"],
//                         stock_status: row["stock_status"],
//                         size_stock_status: row["size_stock_status"],
//                         size_stock_amount: row["size_stock_amount"],
//                         in_stock: row["in_stock"],
//                         stock_quantity: row["stock_quantity"],
//                         reviews: row["reviews"],
//                         average_rating: row["average_rating"],
//                         rating: row["rating"],
//                         number_available: row["number_available"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         isbn: row["isbn"],
//                         upc: row["upc"],
//                         mpn: row["mpn"],
//                         parent_product_id: row["parent_product_id"],
//                         product_GTIN: row["product_GTIN"],
//                         basket_link: row["basket_link"],
//                         last_updated: row["last_updated"],
//                         merchant_thumb_url: row["merchant_thumb_url"],
//                         large_image: row["large_image"],
//                         alternate_image: row["alternate_image"],
//                         aw_thumb_url: row["aw_thumb_url"],
//                         alternate_image_two: row["alternate_image_two"],
//                         alternate_image_three: row["alternate_image_three"],
//                         alternate_image_four: row["alternate_image_four"],
//                         last_imported_at: new Date(),
//                         offers: [offer],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex
//                     };
//                 } else {
//                     if (hasNewVendorId(products[ean].offers, offer)) {
//                         products[ean].offers.push(offer);
//                     }
//                     if (!products[ean].offers.some(o => o.vendor_id === offer.vendor_id)) {
//                         products[ean].offers.push(offer);
//                     }
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ ean: { $in: csvEANs } }).lean();
//                 const bulkOps = [];

//                 for (const ean of csvEANs) {
//                     const newProd = products[ean];
//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                     } else {
//                         const changed = (
//                             existing.search_price !== newProd.search_price ||
//                             hasNewVendorId(existing.offers || [], newProd.offers[0]) ||
//                             !isEqual(stripIgnoredFields(existing.full || {}), stripIgnoredFields(newProd.full))
//                         );
//                         if (changed) {
//                             importStatus.updated++;
//                             bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                             importStatus.debugLog.push(`[UPDATE] ${ean}`);
//                         } else {
//                             importStatus.skipped++;
//                         }
//                     }
//                 }

//                 const deleted = await LiveProduct.deleteMany({ vendor: "reifencom", ean: { $nin: csvEANs } });
//                 importStatus.deleted = deleted.deletedCount || 0;

//                 if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);
//                 importStatus.progress = 100;
//                 console.log(`✅ Import Summary: New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);
//                 resolve();
//             })
//             .on("error", (err) => {
//                 importStatus.error = err.message;
//                 reject(err);
//             });
//     });
// }

// export function getImportProgress(req, res) {
//     res.json(importStatus);
// }

// export async function waitForImportToFinish() {
//     while (importStatus.running) {
//         await new Promise(resolve => setTimeout(resolve, 3000));
//     }
// }
// import fs from "fs";
// import csv from "csv-parser";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import { findLogo } from "../utils/logoFinder.js";
// import {
//     isValidVendor,
//     isValidSecondCategory,
//     isValidThirdCategory,
// } from "../utils/validators.js";
// import isEqual from "lodash.isequal";

// dotenv.config();

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// let importStatus = {
//     running: false,
//     done: false,
//     progress: 0,
//     total: 0,
//     imported: 0,
//     updated: 0,
//     skipped: 0,
//     deleted: 0,
//     error: null,
//     startedAt: null,
//     finishedAt: null,
//     filename: "",
//     debugLog: [],
//     skipReasons: {
//         invalidVendor: 0,
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//     },
// };

// export function startCsvImportAsync(filePath) {
//     importStatus = {
//         ...importStatus,
//         running: true,
//         done: false,
//         progress: 0,
//         imported: 0,
//         updated: 0,
//         skipped: 0,
//         deleted: 0,
//         error: null,
//         startedAt: new Date(),
//         finishedAt: null,
//         filename: filePath,
//         debugLog: [],
//     };

//     importAWINCsv(filePath)
//         .catch(err => {
//             importStatus.error = err.message || String(err);
//         })
//         .finally(() => {
//             importStatus.running = false;
//             importStatus.done = true;
//             importStatus.finishedAt = new Date();
//         });
// }

// function parseTyreDimensions(dim) {
//     if (!dim) return { width: "", height: "", diameter: "" };
//     const parts = dim.match(/\d+/g) || [];
//     return {
//         width: parts[0] || "",
//         height: parts[1] || "",
//         diameter: parts[2] || "",
//     };
// }

// function extractIndexesFromProductName(name) {
//     const rIdx = name.search(/\bR\d+/i);
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }

// function stripIgnoredFields(obj) {
//     const {
//         _id, __v, createdAt, updatedAt, last_imported_at,
//         ...rest
//     } = obj || {};
//     return rest;
// }

// function hasNewVendorId(existingOffers = [], newOffer) {
//     return !existingOffers.some(o => o.vendor_id === newOffer.vendor_id);
// }

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const products = {};
//         let rowCount = 0;
//         const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

//                 if (!isValidVendor(row)) return importStatus.skipReasons.invalidVendor++, importStatus.skipped++;
//                 if (!isValidSecondCategory(row)) return importStatus.skipReasons.invalidSecondCategory++, importStatus.skipped++;
//                 if (!isValidThirdCategory(row)) return importStatus.skipReasons.missingThirdCategory++, importStatus.skipped++;

//                 const ean = row["ean"]?.trim() || row["aw_product_id"];
//                 if (!ean) return;

//                 const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
//                 const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
//                 const thirdCategory = (row["merchant_product_third_category"] || "").trim().toLowerCase();
//                 if (vendor !== "reifencom" || secondCategory !== "reifen" || !thirdCategory.includes("reifen")) return;

//                 const vendorName = row["merchant_name"];
//                 const vendorLogo = findLogo("vendors", vendorName);
//                 const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                 const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                 const offer = {
//                     vendor: vendorName,
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: vendorLogo,
//                     price: parseFloat(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: thirdCategory,
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1",
//                 };

//                 if (!products[ean]) {
//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"],
//                         description: row["description"],
//                         search_price: row["search_price"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         store_price: row["store_price"],
//                         colour: row["colour"],
//                         vendor: vendorName,
//                         product_short_description: row["product_short_description"],
//                         specifications: row["specifications"],
//                         condition: row["condition"],
//                         product_model: row["product_model"],
//                         dimensions: row["dimensions"],
//                         keywords: row["keywords"],
//                         promotional_text: row["promotional_text"],
//                         product_type: row["product_type"],
//                         commission_group: row["commission_group"],
//                         merchant_product_category_path: row["merchant_product_category_path"],
//                         merchant_product_second_category: row["merchant_product_second_category"],
//                         merchant_product_third_category: row["merchant_product_third_category"],
//                         last_updated: row["last_updated"],
//                         in_stock: row["in_stock"],
//                         stock_quantity: row["stock_quantity"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         delivery_cost: row["delivery_cost"],
//                         delivery_time: row["delivery_time"],
//                         mpn: row["mpn"],
//                         offers: [offer],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date()
//                     };
//                 } else {
//                     if (hasNewVendorId(products[ean].offers, offer)) {
//                         products[ean].offers.push(offer);
//                     }
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ ean: { $in: csvEANs } }).lean();

//                 const bulkOps = [];

//                 for (const ean of csvEANs) {
//                     const newProd = products[ean];
//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                     } else {
//                         const changed =
//                             existing.search_price !== newProd.search_price ||
//                             hasNewVendorId(existing.offers || [], newProd.offers[0]) ||
//                             !isEqual(stripIgnoredFields(existing), stripIgnoredFields(newProd));

//                         if (changed) {
//                             importStatus.updated++;
//                             bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                             importStatus.debugLog.push(`[UPDATE] ${ean}`);
//                         } else {
//                             importStatus.skipped++;
//                         }
//                     }
//                 }

//                 const deleted = await LiveProduct.deleteMany({
//                     vendor: "reifencom",
//                     ean: { $nin: csvEANs }
//                 });
//                 importStatus.deleted = deleted.deletedCount || 0;

//                 if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);
//                 importStatus.progress = 100;

//                 console.log(`✅ Import Summary: New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);
//                 resolve();
//             })
//             .on("error", (err) => {
//                 importStatus.error = err.message;
//                 reject(err);
//             });
//     });
// }

// export function getImportProgress(req, res) {
//     res.json(importStatus);
// }

// export async function waitForImportToFinish() {
//     while (importStatus.running) {
//         await new Promise(resolve => setTimeout(resolve, 3000));
//     }
// }
// import fs from "fs";
// import csv from "csv-parser";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import { findLogo } from "../utils/logoFinder.js";
// import {
//     isValidVendor,
//     isValidSecondCategory,
//     isValidThirdCategory,
// } from "../utils/validators.js";
// import isEqual from "lodash.isequal";

// dotenv.config();

// const LiveProduct = mongoose.model("Product", Product.schema, "products");

// let importStatus = {
//     running: false,
//     done: false,
//     progress: 0,
//     total: 0,
//     imported: 0,
//     updated: 0,
//     skipped: 0,
//     deleted: 0,
//     error: null,
//     startedAt: null,
//     finishedAt: null,
//     filename: "",
//     debugLog: [],
//     skipReasons: {
//         invalidVendor: 0,
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//     },
// };

// export function startCsvImportAsync(filePath) {
//     importStatus = {
//         ...importStatus,
//         running: true,
//         done: false,
//         progress: 0,
//         imported: 0,
//         updated: 0,
//         skipped: 0,
//         deleted: 0,
//         error: null,
//         startedAt: new Date(),
//         finishedAt: null,
//         filename: filePath,
//         debugLog: [],
//     };

//     importAWINCsv(filePath)
//         .catch(err => {
//             importStatus.error = err.message || String(err);
//         })
//         .finally(() => {
//             importStatus.running = false;
//             importStatus.done = true;
//             importStatus.finishedAt = new Date();
//         });
// }

// function parseTyreDimensions(dim) {
//     if (!dim) return { width: "", height: "", diameter: "" };
//     const parts = dim.match(/\d+/g) || [];
//     return {
//         width: parts[0] || "",
//         height: parts[1] || "",
//         diameter: parts[2] || "",
//     };
// }

// function extractIndexesFromProductName(name) {
//     const rIdx = name.search(/\bR\d+/i);
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }

// function stripIgnoredFields(obj) {
//     const {
//         _id, __v, createdAt, updatedAt, last_imported_at,
//         ...rest
//     } = obj || {};
//     return rest;
// }

// function sortOffersByVendorId(offers) {
//     return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
// }

// function hasNewVendorId(existingOffers = [], newOffer) {
//     return !existingOffers.some(o => o.vendor_id === newOffer.vendor_id);
// }
// function findChangedFields(existing, incoming) {
//     const changed = [];
//     const strippedExisting = stripIgnoredFields(existing);
//     const strippedNew = stripIgnoredFields(incoming);

//     for (const key in strippedNew) {
//         if (typeof strippedNew[key] === "object") continue; // Skip deep comparison here, like "offers"
//         if (strippedNew[key] !== strippedExisting[key]) {
//             changed.push(key);
//         }
//     }
//     return changed;
// }

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const products = {};
//         let rowCount = 0;
//         const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

//                 if (!isValidVendor(row)) return importStatus.skipReasons.invalidVendor++, importStatus.skipped++;
//                 if (!isValidSecondCategory(row)) return importStatus.skipReasons.invalidSecondCategory++, importStatus.skipped++;
//                 if (!isValidThirdCategory(row)) return importStatus.skipReasons.missingThirdCategory++, importStatus.skipped++;

//                 const ean = row["ean"]?.trim() || row["aw_product_id"];
//                 if (!ean) return;

//                 const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
//                 const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
//                 const thirdCategory = (row["merchant_product_third_category"] || "").trim().toLowerCase();
//                 if (vendor !== "reifencom" || secondCategory !== "reifen" || !thirdCategory.includes("reifen")) return;

//                 const vendorName = row["merchant_name"];
//                 const vendorLogo = findLogo("vendors", vendorName);
//                 const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                 const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                 const offer = {
//                     vendor: vendorName,
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: vendorLogo,
//                     price: parseFloat(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: thirdCategory,
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1",
//                 };

//                 if (!products[ean]) {
//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"],
//                         description: row["description"],
//                         search_price: row["search_price"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         store_price: row["store_price"],
//                         colour: row["colour"],
//                         vendor: vendorName,
//                         product_short_description: row["product_short_description"],
//                         specifications: row["specifications"],
//                         condition: row["condition"],
//                         product_model: row["product_model"],
//                         dimensions: row["dimensions"],
//                         keywords: row["keywords"],
//                         promotional_text: row["promotional_text"],
//                         product_type: row["product_type"],
//                         commission_group: row["commission_group"],
//                         merchant_product_category_path: row["merchant_product_category_path"],
//                         merchant_product_second_category: row["merchant_product_second_category"],
//                         merchant_product_third_category: row["merchant_product_third_category"],
//                         last_updated: row["last_updated"],
//                         in_stock: row["in_stock"],
//                         stock_quantity: row["stock_quantity"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         delivery_cost: row["delivery_cost"],
//                         delivery_time: row["delivery_time"],
//                         mpn: row["mpn"],
//                         offers: [offer],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date()
//                     };
//                 } else {
//                     if (hasNewVendorId(products[ean].offers, offer)) {
//                         products[ean].offers.push(offer);
//                     }
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ ean: { $in: csvEANs } }).lean();

//                 const bulkOps = [];

//                 // for (const ean of csvEANs) {
//                 //     const newProd = products[ean];
//                 //     const existing = existingProducts.find(p => p.ean === ean);

//                 //     const changedFields = findChangedFields(existing, newProd);
//                 //     const changed =
//                 //         existing.search_price !== newProd.search_price ||
//                 //         hasNewVendorId(existing.offers || [], newProd.offers[0]) ||
//                 //         !isEqual(stripIgnoredFields(existing), stripIgnoredFields(newProd));

//                 //     if (changed) {
//                 //         importStatus.updated++;
//                 //         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });

//                 //         const reasons = [];
//                 //         if (existing.search_price !== newProd.search_price) reasons.push("search_price");
//                 //         if (hasNewVendorId(existing.offers || [], newProd.offers[0])) reasons.push("new_vendor_id");
//                 //         if (changedFields.length) reasons.push("fields: " + changedFields.join(", "));

//                 //         importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join("; ")}`);
//                 //     }
                    
//                 //     if (!existing) {
//                 //         importStatus.imported++;
//                 //         bulkOps.push({ insertOne: { document: newProd } });
//                 //         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                 //     } else {
//                 //         const reasons = [];

//                 //         if (Number(existing.search_price) !== Number(newProd.search_price)) reasons.push("search_price");
//                 //         if (hasNewVendorId(existing.offers || [], newProd.offers[0])) reasons.push("new vendor_id in offers");
//                 //         const cleanOld = { ...stripIgnoredFields(existing), offers: sortOffersByVendorId(existing.offers) };
//                 //         const cleanNew = { ...stripIgnoredFields(newProd), offers: sortOffersByVendorId(newProd.offers) };
//                 //         if (!isEqual(cleanOld, cleanNew)) reasons.push("field mismatch");

//                 //         if (reasons.length > 0) {
//                 //             importStatus.updated++;
//                 //             bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                 //             importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
//                 //         } else {
//                 //             importStatus.skipped++;
//                 //         }
//                 //     }
//                 // }
//                 for (const ean of csvEANs) {
//                     const newProd = products[ean];
//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                     } else {
//                         const reasons = [];
//                         const changedFields = findChangedFields(existing, newProd);

//                         const offersChanged = hasNewVendorId(existing.offers || [], newProd.offers[0]);

//                         const cleanOld = {
//                             ...stripIgnoredFields(existing),
//                             offers: sortOffersByVendorId(existing.offers || [])
//                         };

//                         const cleanNew = {
//                             ...stripIgnoredFields(newProd),
//                             offers: sortOffersByVendorId(newProd.offers || [])
//                         };

//                         const deepChanged = !isEqual(cleanOld, cleanNew);

//                         if (changedFields.length > 0) reasons.push(`fields: ${changedFields.join(", ")}`);
//                         if (offersChanged) reasons.push("new_vendor_id in offers");

//                         if (reasons.length > 0 || deepChanged) {
//                             importStatus.updated++;
//                             bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                             importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join("; ")}`);
//                         } else {
//                             importStatus.skipped++;
//                         }
//                     }
//                 }
                
//                 const deleted = await LiveProduct.deleteMany({ vendor: "reifencom", ean: { $nin: csvEANs } });
//                 importStatus.deleted = deleted.deletedCount || 0;

//                 if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);
//                 importStatus.progress = 100;

//                 console.log(`✅ Import Summary: New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);
//                 resolve();
//             })
//             .on("error", (err) => {
//                 importStatus.error = err.message;
//                 reject(err);
//             });
//     });
// }

// export function getImportProgress(req, res) {
//     res.json(importStatus);
// }

// export async function waitForImportToFinish() {
//     while (importStatus.running) {
//         await new Promise(resolve => setTimeout(resolve, 3000));
//     }
// }
import fs from "fs";
import csv from "csv-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import { findLogo } from "../utils/logoFinder.js";
import {
    isValidVendor,
    isValidSecondCategory,
    isValidThirdCategory,
} from "../utils/validators.js";
import isEqual from "lodash.isequal";

dotenv.config();

const LiveProduct = mongoose.model("Product", Product.schema, "products");

let importStatus = {
    running: false,
    done: false,
    progress: 0,
    total: 0,
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
        invalidVendor: 0,
        invalidSecondCategory: 0,
        missingThirdCategory: 0,
    },
};

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

function parseTyreDimensions(dim) {
    if (!dim) return { width: "", height: "", diameter: "" };
    const parts = dim.match(/\d+/g) || [];
    return {
        width: parts[0] || "",
        height: parts[1] || "",
        diameter: parts[2] || "",
    };
}

function extractIndexesFromProductName(name) {
    const rIdx = name.search(/\bR\d+/i);
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

function hasNewVendorId(existingOffers = [], newOffer) {
    return !existingOffers.some(o => o.vendor_id === newOffer.vendor_id);
}

function findChangedFields(existing, incoming) {
    const changed = [];
    const a = stripIgnoredFields(existing);
    const b = stripIgnoredFields(incoming);

    for (const key in b) {
        if (typeof b[key] === "object") continue;
        if (normalizeField(a[key]) !== normalizeField(b[key])) {
            changed.push(key);
        }
    }
    return changed;
}

export async function importAWINCsv(filePath) {
    return new Promise((resolve, reject) => {
        const products = {};
        let rowCount = 0;
        const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
        importStatus.total = totalLines;

        fs.createReadStream(filePath)
            .pipe(csv({ separator: ";" }))
            .on("data", (row) => {
                rowCount++;
                importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

                if (!isValidVendor(row)) return importStatus.skipReasons.invalidVendor++, importStatus.skipped++;
                if (!isValidSecondCategory(row)) return importStatus.skipReasons.invalidSecondCategory++, importStatus.skipped++;
                if (!isValidThirdCategory(row)) return importStatus.skipReasons.missingThirdCategory++, importStatus.skipped++;

                const ean = row["ean"]?.trim() || row["aw_product_id"];
                if (!ean) return;

                const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
                const secondCategory = (row["merchant_product_second_category"] || "").trim().toLowerCase();
                const thirdCategory = (row["merchant_product_third_category"] || "").trim().toLowerCase();
                if (vendor !== "reifencom" || secondCategory !== "reifen" || !thirdCategory.includes("reifen")) return;

                const vendorName = row["merchant_name"];
                const vendorLogo = findLogo("vendors", vendorName);
                const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
                const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

                const offer = {
                    vendor: vendorName,
                    vendor_id: row["merchant_id"],
                    brand_name: row["brand_name"],
                    product_name: row["product_name"],
                    vendor_logo: vendorLogo,
                    price: parseFloat(row["search_price"]) || 0,
                    currency: row["currency"],
                    aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
                    original_affiliate_url: row["aw_deep_link"],
                    delivery_cost: row["delivery_cost"],
                    delivery_time: row["delivery_time"],
                    product_category: thirdCategory,
                    merchant_deep_link: row["merchant_deep_link"],
                    in_stock: row["in_stock"] === "1",
                };

                if (!products[ean]) {
                    products[ean] = {
                        ean,
                        aw_product_id: row["aw_product_id"],
                        merchant_product_id: row["merchant_product_id"],
                        product_name: row["product_name"],
                        brand_name: row["brand_name"],
                        brand_logo: findLogo("brands", row["brand_name"]),
                        category_name: row["category_name"],
                        category_id: row["category_id"],
                        product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"],
                        description: row["description"],
                        search_price: row["search_price"],
                        product_url: row["aw_deep_link"],
                        currency: row["currency"],
                        store_price: row["store_price"],
                        colour: row["colour"],
                        vendor: vendorName,
                        product_short_description: row["product_short_description"],
                        specifications: row["specifications"],
                        condition: row["condition"],
                        product_model: row["product_model"],
                        dimensions: row["dimensions"],
                        keywords: row["keywords"],
                        promotional_text: row["promotional_text"],
                        product_type: row["product_type"],
                        commission_group: row["commission_group"],
                        merchant_product_category_path: row["merchant_product_category_path"],
                        merchant_product_second_category: row["merchant_product_second_category"],
                        merchant_product_third_category: row["merchant_product_third_category"],
                        last_updated: row["last_updated"],
                        in_stock: row["in_stock"],
                        stock_quantity: row["stock_quantity"],
                        noise_class: row["custom_1"],
                        wet_grip: row["custom_2"],
                        fuel_class: row["custom_3"],
                        delivery_cost: row["delivery_cost"],
                        delivery_time: row["delivery_time"],
                        mpn: row["mpn"],
                        offers: [offer],
                        width,
                        height,
                        diameter,
                        speedIndex,
                        lastIndex,
                        last_imported_at: new Date()
                    };
                } else {
                    if (hasNewVendorId(products[ean].offers, offer)) {
                        products[ean].offers.push(offer);
                    }
                }
            })
            .on("end", async () => {
                const csvEANs = Object.keys(products);
                const existingProducts = await LiveProduct.find({ ean: { $in: csvEANs } }).lean();
                const bulkOps = [];

                for (const ean of csvEANs) {
                    const newProd = products[ean];
                    const existing = existingProducts.find(p => p.ean === ean);

                    if (!existing) {
                        importStatus.imported++;
                        bulkOps.push({ insertOne: { document: newProd } });
                        importStatus.debugLog.push(`[INSERT] ${ean}`);
                        continue;
                    }

                    const existingOffersSorted = sortOffersByVendorId(existing.offers);
                    const newOffersSorted = sortOffersByVendorId(newProd.offers);
                    const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
                    const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };

                    if (!isEqual(cleanExisting, cleanNew)) {
                        const reasons = findChangedFields(existing, newProd);
                        if (hasNewVendorId(existing.offers || [], newProd.offers[0])) reasons.push("new_vendor_id");
                        importStatus.updated++;
                        bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
                        importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
                    } else {
                        importStatus.skipped++;
                    }
                }

                const deleted = await LiveProduct.deleteMany({ vendor: "reifencom", ean: { $nin: csvEANs } });
                importStatus.deleted = deleted.deletedCount || 0;

                if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);
                importStatus.progress = 100;

                console.log(`✅ Import Summary: New: ${importStatus.imported}, Updated: ${importStatus.updated}, Skipped: ${importStatus.skipped}, Deleted: ${importStatus.deleted}`);
                resolve();
            })
            .on("error", (err) => {
                importStatus.error = err.message;
                reject(err);
            });
    });
}

export function getImportProgress(req, res) {
    res.json(importStatus);
}

export async function waitForImportToFinish() {
    while (importStatus.running) {
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
}
