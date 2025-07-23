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

// =============================
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
//     const { _id, __v, createdAt, updatedAt, last_imported_at, ...rest } = obj || {};
//     return rest;
// }

// function normalizeField(val) {
//     if (typeof val === "string") return val.trim().toLowerCase();
//     if (typeof val === "number") return Number(val);
//     return val;
// }

// function sortOffersByVendorId(offers) {
//     return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
// }

// function hasNewVendorId(existingOffers = [], newOffer) {
//     return !existingOffers.some(o => o.vendor_id === newOffer.vendor_id);
// }

// function findChangedFields(existing, incoming) {
//     const changed = [];
//     const a = stripIgnoredFields(existing);
//     const b = stripIgnoredFields(incoming);

//     for (const key in b) {
//         if (typeof b[key] === "object") continue;
//         if (normalizeField(a[key]) !== normalizeField(b[key])) {
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
//                     in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
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
//                         in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
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
//                         continue;
//                     }

//                     const existingOffersSorted = sortOffersByVendorId(existing.offers);
//                     const newOffersSorted = sortOffersByVendorId(newProd.offers);
//                     const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
//                     const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };

//                     if (!isEqual(cleanExisting, cleanNew)) {
//                         const reasons = findChangedFields(existing, newProd);
//                         if (hasNewVendorId(existing.offers || [], newProd.offers[0])) reasons.push("new_vendor_id");
//                         importStatus.updated++;
//                         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                         importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
//                     } else {
//                         importStatus.skipped++;
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


// importAWINCsv.js

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

// function parseSafeNumber(val) {
//     if (!val || typeof val === 'undefined' || val === '' || val === 'NaN') return undefined;
//     const normalized = String(val).replace(',', '.').trim();
//     const num = parseFloat(normalized);
//     return isNaN(num) ? undefined : num;
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
//     const { _id, __v, createdAt, updatedAt, last_imported_at, ...rest } = obj || {};
//     return rest;
// }

// function normalizeField(val) {
//     if (typeof val === "string") return val.trim().toLowerCase();
//     if (typeof val === "number") return Number(val);
//     return val;
// }

// function sortOffersByVendorId(offers) {
//     return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
// }

// function hasNewVendorId(existingOffers = [], newOffers = []) {
//     const existingIds = existingOffers.map(o => o.vendor_id);
//     return newOffers.some(o => !existingIds.includes(o.vendor_id));
// }

// function findChangedFields(existing, incoming) {
//     const changed = [];
//     const a = stripIgnoredFields(existing);
//     const b = stripIgnoredFields(incoming);

//     for (const key in b) {
//         if (typeof b[key] === "object") continue;
//         if (normalizeField(a[key]) !== normalizeField(b[key])) {
//             changed.push(key);
//         }
//     }
//     return changed;
// }

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

//                 const offer = {
//                     vendor: row["merchant_name"],
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: findLogo("vendors", row["merchant_name"]),
//                     price: parseSafeNumber(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: row["merchant_product_third_category"],
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                 };

//                 if (!products[ean]) {
//                     const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                     const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"] || row["large_image"],
//                         description: row["description"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         vendor: row["merchant_name"],
//                         delivery_time: row["delivery_time"],
//                         offers: [offer],
//                         savings_percent: "",
//                         total_offers: 1,
//                         store_price: parseSafeNumber(row["store_price"]),
//                         search_price: parseSafeNumber(row["search_price"]),
//                         rrp_price: parseSafeNumber(row["rrp_price"]),
//                         cheapest_offer: parseSafeNumber(row["search_price"]),
//                         expensive_offer: parseSafeNumber(row["search_price"]),
//                         savings_amount: 0,
//                         colour: row["colour"],
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
//                         in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                         stock_quantity: row["stock_quantity"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         delivery_cost: row["delivery_cost"],
//                         mpn: row["mpn"],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date()
//                     };
//                 } else {
//                     products[ean].offers.push(offer);
//                     products[ean].total_offers++;
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ ean: { $in: csvEANs } }).lean();
//                 const bulkOps = [];

//                 for (const ean of csvEANs) {
//                     const newProd = products[ean];
//                     const prices = newProd.offers.map(o => o.price).filter(p => p > 0);
//                     const cheapest = Math.min(...prices);
//                     const mostExpensive = Math.max(...prices);
//                     newProd.cheapest_offer = cheapest;
//                     newProd.expensive_offer = mostExpensive;
//                     newProd.savings_amount = (mostExpensive - cheapest).toFixed(2);
//                     newProd.savings_percent = mostExpensive > cheapest ? `${Math.round((mostExpensive - cheapest) / mostExpensive * 100)}%` : "0%";

//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                         continue;
//                     }

//                     const existingOffersSorted = sortOffersByVendorId(existing.offers);
//                     const newOffersSorted = sortOffersByVendorId(newProd.offers);
//                     const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
//                     const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };

//                     if (!isEqual(cleanExisting, cleanNew)) {
//                         const reasons = findChangedFields(existing, newProd);
//                         if (hasNewVendorId(existing.offers || [], newProd.offers)) reasons.push("new_vendor_id");
//                         importStatus.updated++;
//                         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                         importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
//                     } else {
//                         importStatus.skipped++;
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

// ===============================
// ===============================
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
//         missingEAN: 0,
//     },
// };

// function parseSafeNumber(val) {
//     if (!val || typeof val === 'undefined' || val === '' || val === 'NaN') return undefined;
//     const normalized = String(val).replace(',', '.').trim();
//     const num = parseFloat(normalized);
//     return isNaN(num) ? undefined : num;
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
//     const { _id, __v, createdAt, updatedAt, last_imported_at, ...rest } = obj || {};
//     return rest;
// }

// function normalizeField(val) {
//     if (typeof val === "string") return val.trim().toLowerCase();
//     if (typeof val === "number") return Number(val);
//     return val;
// }

// function sortOffersByVendorId(offers) {
//     return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
// }

// function hasNewVendorId(existingOffers = [], newOffers = []) {
//     const existingIds = existingOffers.map(o => o.vendor_id);
//     return newOffers.some(o => !existingIds.includes(o.vendor_id));
// }

// function findChangedFields(existing, incoming) {
//     const changed = [];
//     const a = stripIgnoredFields(existing);
//     const b = stripIgnoredFields(incoming);

//     for (const key in b) {
//         if (typeof b[key] === "object") continue;
//         if (normalizeField(a[key]) !== normalizeField(b[key])) {
//             changed.push(key);
//         }
//     }
//     return changed;
// }


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
//                 if (!ean) return importStatus.skipReasons.missingEAN++, importStatus.skipped++;
               
//                 const offer = {
//                     vendor: row["merchant_name"],
//                     vendor_id: row["merchant_id"],
//                     brand_name: row["brand_name"],
//                     product_name: row["product_name"],
//                     vendor_logo: findLogo("vendors", row["merchant_name"]),
//                     price: parseSafeNumber(row["search_price"]) || 0,
//                     currency: row["currency"],
//                     aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                     original_affiliate_url: row["aw_deep_link"],
//                     delivery_cost: row["delivery_cost"],
//                     delivery_time: row["delivery_time"],
//                     product_category: row["merchant_product_third_category"],
//                     merchant_deep_link: row["merchant_deep_link"],
//                     in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                 };
                
//                 if (!products[ean]) {
//                     const { width, height, diameter } = parseTyreDimensions(row["dimensions"]);
//                     const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"]);

//                     products[ean] = {
//                         ean,
//                         aw_product_id: row["aw_product_id"],
//                         merchant_product_id: row["merchant_product_id"],
//                         product_name: row["product_name"],
//                         brand_name: row["brand_name"],
//                         brand_logo: findLogo("brands", row["brand_name"]),
//                         category_name: row["category_name"],
//                         category_id: row["category_id"],
//                         product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"] || row["large_image"],
//                         description: row["description"],
//                         product_url: row["aw_deep_link"],
//                         currency: row["currency"],
//                         vendor: row["merchant_name"],
//                         merchant_deep_link: row["merchant_deep_link"],
//                         delivery_time: row["delivery_time"],
//                         offers: [offer],
//                         savings_percent: "",
//                         total_offers: 1,
//                         store_price: parseSafeNumber(row["store_price"]),
//                         search_price: parseSafeNumber(row["search_price"]),
//                         rrp_price: parseSafeNumber(row["rrp_price"]),
//                         cheapest_offer: parseSafeNumber(row["search_price"]),
//                         expensive_offer: parseSafeNumber(row["search_price"]),
//                         savings_amount: 0,
//                         colour: row["colour"],
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
//                         in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                         stock_quantity: row["stock_quantity"],
//                         noise_class: row["custom_1"],
//                         wet_grip: row["custom_2"],
//                         fuel_class: row["custom_3"],
//                         delivery_cost: row["delivery_cost"],
//                         mpn: row["mpn"],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date()
//                     };
//                 } else {
//                     products[ean].offers.push(offer);
//                     products[ean].total_offers++;
//                 }
//             })
//             .on("end", async () => {
//                 const csvEANs = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ ean: { $in: csvEANs } }).lean();
//                 const bulkOps = [];

//                 for (const ean of csvEANs) {
//                     const newProd = products[ean];
//                     const prices = newProd.offers.map(o => o.price).filter(p => p > 0);
//                     const cheapest = Math.min(...prices);
//                     const mostExpensive = Math.max(...prices);
//                     newProd.cheapest_offer = cheapest;
//                     newProd.expensive_offer = mostExpensive;
//                     newProd.savings_amount = Number((mostExpensive - cheapest).toFixed(2));
//                     newProd.savings_percent = mostExpensive > cheapest ? `${Math.round((mostExpensive - cheapest) / mostExpensive * 100)}%` : "0%";

//                     const existing = existingProducts.find(p => p.ean === ean);

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                         continue;
//                     }

//                     const existingOffersSorted = sortOffersByVendorId(existing.offers);
//                     const newOffersSorted = sortOffersByVendorId(newProd.offers);
//                     const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
//                     const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };

//                     if (!isEqual(cleanExisting, cleanNew)) {
//                         const reasons = findChangedFields(existing, newProd);
//                         if (hasNewVendorId(existing.offers || [], newProd.offers)) reasons.push("new_vendor_id");
//                         importStatus.updated++;
//                         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                         importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
//                     } else {
//                         importStatus.skipped++;
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

// [new start=============]
// import fs from "fs";
// import csv from "csv-parser";
// import dotenv from "dotenv";
// import mongoose from "mongoose";
// import Product from "../../models/product.js";
// import { findLogo } from "../utils/logoFinder.js";
// import isEqual from "lodash.isequal";
// import { isValidVendor, isValidSecondCategory, isValidThirdCategory } from "../utils/validators.js";

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
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//         missingEAN: 0,
//     },
//     vendors: [],
// };

// // Utility functions ...
// function parseSafeNumber(val) {
//     if (!val || typeof val === 'undefined' || val === '' || val === 'NaN') return undefined;
//     const normalized = String(val).replace(',', '.').trim();
//     const num = parseFloat(normalized);
//     return isNaN(num) ? undefined : num;
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
//     const rIdx = name ? name.search(/\bR\d+/i) : -1;
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }
// function stripIgnoredFields(obj) {
//     const { _id, __v, createdAt, updatedAt, last_imported_at, ...rest } = obj || {};
//     return rest;
// }
// function normalizeField(val) {
//     if (typeof val === "string") return val.trim().toLowerCase();
//     if (typeof val === "number") return Number(val);
//     return val;
// }
// function sortOffersByVendorId(offers) {
//     return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
// }
// function hasNewVendorId(existingOffers = [], newOffers = []) {
//     const existingIds = existingOffers.map(o => o.vendor_id);
//     return newOffers.some(o => !existingIds.includes(o.vendor_id));
// }
// function findChangedFields(existing, incoming) {
//     const changed = [];
//     const a = stripIgnoredFields(existing);
//     const b = stripIgnoredFields(incoming);
//     for (const key in b) {
//         if (typeof b[key] === "object") continue;
//         if (normalizeField(a[key]) !== normalizeField(b[key])) {
//             changed.push(key);
//         }
//     }
//     return changed;
// }
// // function groupRowsByEAN(rows) {
// //     const grouped = {};
// //     for (const row of rows) {
// //         const ean = row["ean"]?.trim() || row["aw_product_id"];
// //         if (!ean) continue;
// //         if (!grouped[ean]) grouped[ean] = [];
// //         grouped[ean].push(row);
// //     }
// //     return grouped;
// // }
// // GET PRODUCT KEY FOR GROUPING
// // Get the best product key for grouping (EAN, GTIN, UPC, AW_ID)
// function getProductKey(row) {
//     const candidates = ['ean', 'gtin', 'upc', 'aw_product_id'];
//     for (let field of candidates) {
//         const val = row[field];
//         if (val && typeof val === 'string' && val.trim().length > 0) return val.trim();
//     }
//     return null;
// }

// // Group all rows by the product key
// function groupRowsByProductKey(rows) {
//     const grouped = {};
//     for (const row of rows) {
//         const key = getProductKey(row);
//         if (!key) continue;
//         if (!grouped[key]) grouped[key] = [];
//         grouped[key].push(row);
//     }
//     return grouped;
// }


// // Calculate savings for a specific vendor
// function getVendorSavings(currentVendor, offers) {
//     if (!currentVendor || !offers.length) return { savings_amount: 0, savings_percent: "0%", before_price: undefined };
//     // Normalize vendor name for matching
//     const normName = (currentVendor || "").toLowerCase().replace(/\s|\./g, "");
//     const mainOffer = offers.find(o => (o.vendor || "").toLowerCase().replace(/\s|\./g, "") === normName);
//     if (!mainOffer) return { savings_amount: 0, savings_percent: "0%", before_price: undefined };

//     const myPrice = mainOffer.price;
//     const otherOffers = offers.filter(o => o !== mainOffer && o.price > 0);
//     if (!otherOffers.length) return { savings_amount: 0, savings_percent: "0%", before_price: undefined };

//     const maxOtherPrice = Math.max(...otherOffers.map(o => o.price));
//     if (maxOtherPrice <= myPrice) return { savings_amount: 0, savings_percent: "0%", before_price: maxOtherPrice };

//     const savingsAmount = Number((maxOtherPrice - myPrice).toFixed(2));
//     const savingsPercent = Math.round((maxOtherPrice - myPrice) / maxOtherPrice * 100);
//     return {
//         savings_amount: savingsAmount,
//         savings_percent: `-${savingsPercent}%`,
       
//     };
// }

// // Main import
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
//         vendors: [],
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

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const rows = [];
//         const vendorsFound = new Set();
//         let rowCount = 0;
//         const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

//                 // --- VENDOR LOGIC ---
//                 if (row["merchant_name"]) vendorsFound.add(row["merchant_name"].trim());

//                 // Validation steps
//                 if (!isValidVendor(row)) return;
//                 if (!isValidSecondCategory(row)) { importStatus.skipReasons.invalidSecondCategory++; importStatus.skipped++; return; }
//                 if (!isValidThirdCategory(row)) { importStatus.skipReasons.missingThirdCategory++; importStatus.skipped++; return; }
//                 const ean = row["ean"]?.trim() || row["aw_product_id"];
//                 if (!ean) { importStatus.skipReasons.missingEAN++; importStatus.skipped++; return; }

//                 // Type consistency
//                 row["search_price"] = parseSafeNumber(row["search_price"]);
//                 row["store_price"] = parseSafeNumber(row["store_price"]);
//                 row["rrp_price"] = parseSafeNumber(row["rrp_price"]);

//                 rows.push(row);
//             })
//             .on("end", async () => {
//                 importStatus.vendors = Array.from(vendorsFound).sort();
//                 console.log("Unique vendors in CSV:", importStatus.vendors);

//                 const grouped = groupRowsByProductKey(rows);
//                 const products = {};
//                 for (const ean in grouped) {
//                     const vendorRows = grouped[ean];
//                     // Prefer reifencom as master
//                     let masterRow = vendorRows.find(r => (r["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "") === "reifencom");
//                     if (!masterRow) masterRow = vendorRows[0];

//                     const offers = vendorRows.map(row => ({
//                         vendor: row["merchant_name"],
//                         vendor_id: row["merchant_id"],
//                         brand_name: row["brand_name"],
//                         product_name: row["product_name"],
//                         vendor_logo: findLogo("vendors", row["merchant_name"]),
//                         price: parseSafeNumber(row["search_price"]) || 0,
//                         currency: row["currency"],
//                         aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                         original_affiliate_url: row["aw_deep_link"],
//                         delivery_cost: row["delivery_cost"],
//                         delivery_time: row["delivery_time"],
//                         product_category: row["merchant_product_third_category"],
//                         merchant_deep_link: row["merchant_deep_link"],
//                         in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                     }));

//                     const { width, height, diameter } = parseTyreDimensions(masterRow["dimensions"]);
//                     const { speedIndex, lastIndex } = extractIndexesFromProductName(masterRow["product_name"]);
//                     const prices = offers.map(o => o.price).filter(p => p > 0);
//                     const cheapest = Math.min(...prices);
//                     const mostExpensive = Math.max(...prices);

//                     // Calculate "you save" for the main vendor (default: reifencom or masterRow)
//                     const mainVendor = masterRow["merchant_name"];
//                     const savings = getVendorSavings(mainVendor, offers);

//                     products[ean] = {
//                         ean,
//                         aw_product_id: masterRow["aw_product_id"],
//                         merchant_product_id: masterRow["merchant_product_id"],
//                         product_name: masterRow["product_name"],
//                         brand_name: masterRow["brand_name"],
//                         brand_logo: findLogo("brands", masterRow["brand_name"]),
//                         category_name: masterRow["category_name"],
//                         category_id: masterRow["category_id"],
//                         product_image: masterRow["merchant_image_url"] || masterRow["aw_image_url"] || masterRow["aw_thumb_url"] || masterRow["large_image"],
//                         description: masterRow["description"],
//                         product_url: masterRow["aw_deep_link"],
//                         currency: masterRow["currency"],
//                         vendor: masterRow["merchant_name"],
//                         merchant_deep_link: masterRow["merchant_deep_link"],
//                         delivery_time: masterRow["delivery_time"],
//                         offers,
//                         savings_percent: savings.savings_percent,
//                         savings_amount: savings.savings_amount,
//                         before_price: savings.before_price, // For showing the strikethrough price
//                         total_offers: offers.length,
//                         store_price: parseSafeNumber(masterRow["store_price"]),
//                         search_price: parseSafeNumber(masterRow["search_price"]),
//                         rrp_price: parseSafeNumber(masterRow["rrp_price"]),
//                         cheapest_offer: cheapest,
//                         expensive_offer: mostExpensive,
//                         colour: masterRow["colour"],
//                         product_short_description: masterRow["product_short_description"],
//                         specifications: masterRow["specifications"],
//                         condition: masterRow["condition"],
//                         product_model: masterRow["product_model"],
//                         dimensions: masterRow["dimensions"],
//                         keywords: masterRow["keywords"],
//                         promotional_text: masterRow["promotional_text"],
//                         product_type: masterRow["product_type"],
//                         commission_group: masterRow["commission_group"],
//                         merchant_product_category_path: masterRow["merchant_product_category_path"],
//                         merchant_product_second_category: masterRow["merchant_product_second_category"],
//                         merchant_product_third_category: masterRow["merchant_product_third_category"],
//                         last_updated: masterRow["last_updated"],
//                         in_stock: masterRow["in_stock"] === "1" || masterRow["in_stock"] === 1 || masterRow["in_stock"] === 1.0,
//                         stock_quantity: masterRow["stock_quantity"],
//                         noise_class: masterRow["custom_1"],
//                         wet_grip: masterRow["custom_2"],
//                         fuel_class: masterRow["custom_3"],
//                         delivery_cost: masterRow["delivery_cost"],
//                         mpn: masterRow["mpn"],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date()
//                     };
//                 }
//                 // === Debug section: Log number of offers (vendors) per product ===
//                 console.log("------ Offer Counts Per Product ------");
//                 Object.entries(products).forEach(([ean, product]) => {
//                     const offerVendors = product.offers.map(o => o.vendor).join(", ");
//                     console.log(`EAN: ${ean} | #Offers: ${product.offers.length} | Vendors: ${offerVendors}`);
//                 });
//                 console.log("--------------------------------------");
//                 // === End debug section ===

//                 // Bulk DB logic
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
//                         continue;
//                     }
//                     const existingOffersSorted = sortOffersByVendorId(existing.offers);
//                     const newOffersSorted = sortOffersByVendorId(newProd.offers);
//                     const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
//                     const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };
//                     if (!isEqual(cleanExisting, cleanNew)) {
//                         const reasons = findChangedFields(existing, newProd);
//                         if (hasNewVendorId(existing.offers || [], newProd.offers)) reasons.push("new_vendor_id");
//                         importStatus.updated++;
//                         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                         importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
//                     } else {
//                         importStatus.skipped++;
//                     }
//                 }

//                 // --- Delete products not in CSV by EAN ---
//                 const csvEANsSet = new Set(csvEANs);
//                 const allDbEANs = (await LiveProduct.find({}, { ean: 1 }).lean()).map(p => p.ean);
//                 const toDeleteEANs = allDbEANs.filter(ean => !csvEANsSet.has(ean));
//                 if (toDeleteEANs.length > 0) {
//                     const deleted = await LiveProduct.deleteMany({ ean: { $in: toDeleteEANs } });
//                     importStatus.deleted = deleted.deletedCount || 0;
//                 } else {
//                     importStatus.deleted = 0;
//                 }

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

// // Return current vendors from the last import
// export function getVendorsFromLastImport(req, res) {
//     res.json({ vendors: importStatus.vendors });
// }

// // Optionally, query all distinct vendors from the database (for admin dashboard)
// export async function getVendorsFromDatabase(req, res) {
//     const products = await LiveProduct.find({}, { offers: 1 }).lean();
//     const vendors = new Set();
//     for (const prod of products) {
//         (prod.offers || []).forEach(offer => {
//             if (offer.vendor) vendors.add(offer.vendor);
//         });
//     }
//     res.json({ vendors: Array.from(vendors).sort() });
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
// import isEqual from "lodash.isequal";
// import {
//     isCarTyreGroup,
//     isValidVendor
// } from "../utils/validators.js";

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
//         invalidSecondCategory: 0,
//         missingThirdCategory: 0,
//         missingEAN: 0,
//     },
//     vendors: [],
// };

// // --- Utility Functions ---
// function parseSafeNumber(val) {
//     if (!val || typeof val === 'undefined' || val === '' || val === 'NaN') return undefined;
//     const normalized = String(val).replace(',', '.').trim();
//     const num = parseFloat(normalized);
//     return isNaN(num) ? undefined : num;
// }
// function parseTyreDimensions(dim) {
//     if (!dim) return { width: "", height: "", diameter: "" };
//     const parts = dim.match(/\d+/g) || [];
//     return { width: parts[0] || "", height: parts[1] || "", diameter: parts[2] || "" };
// }
// function extractIndexesFromProductName(name) {
//     const rIdx = name ? name.search(/\bR\d+/i) : -1;
//     if (rIdx === -1) return { lastIndex: "", speedIndex: "" };
//     const tail = name.substring(rIdx + 2);
//     const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//     return idxMatch ? { lastIndex: idxMatch[1], speedIndex: idxMatch[2] } : { lastIndex: "", speedIndex: "" };
// }
// function stripIgnoredFields(obj) {
//     const { _id, __v, createdAt, updatedAt, last_imported_at, ...rest } = obj || {};
//     return rest;
// }
// function normalizeField(val) {
//     if (typeof val === "string") return val.trim().toLowerCase();
//     if (typeof val === "number") return Number(val);
//     return val;
// }
// function sortOffersByVendorId(offers) {
//     return [...(offers || [])].sort((a, b) => (a.vendor_id || "").localeCompare(b.vendor_id || ""));
// }
// function hasNewVendorId(existingOffers = [], newOffers = []) {
//     const existingIds = existingOffers.map(o => o.vendor_id);
//     return newOffers.some(o => !existingIds.includes(o.vendor_id));
// }
// const COMPARE_FIELDS = [
//     "ean", "gtin", "upc", "aw_product_id", "merchant_product_id",
//     "product_name", "brand_name", "product_image", "description",
//     "product_url", "merchant_deep_link","delivery_time",
//     "main_price", "product_short_description", "specifications", "condition",
//     "product_model", "dimensions", "keywords", "promotional_text",
//     "product_type", "commission_group", "category_name", "category_id",
//     "merchant_product_category_path", "currency",
//     "merchant_product_second_category", "merchant_product_third_category",
//     "in_stock", "stock_quantity","delivery_cost", "mpn",
// ];

// function findChangedFields(existing, incoming) {
//     const changed = [];
//     const a = stripIgnoredFields(existing);
//     const b = stripIgnoredFields(incoming);
//     for (const key of COMPARE_FIELDS) {
//         if (typeof b[key] === "object") continue;
//         if (normalizeField(a[key]) !== normalizeField(b[key])) {
//             changed.push(key);
//         }
//     }
//     return changed;
// }

// // function findChangedFields(existing, incoming) {
// //     const changed = [];
// //     const a = stripIgnoredFields(existing);
// //     const b = stripIgnoredFields(incoming);
// //     for (const key in b) {
// //         if (typeof b[key] === "object") continue;
// //         if (normalizeField(a[key]) !== normalizeField(b[key])) {
// //             changed.push(key);
// //         }
// //     }
// //     return changed;
// // }

// function getProductKey(row) {
//     // Only group by EAN
//     const ean = row['ean'];
//     if (ean && typeof ean === 'string' && ean.trim().length > 0) {
//         return ean.trim();
//     }
//     return null;
// }

// function groupRowsByProductKey(rows) {
//     const grouped = {};
//     for (const row of rows) {
//         const key = getProductKey(row);
//         if (!key) continue;
//         if (!grouped[key]) grouped[key] = [];
//         grouped[key].push(row);
//     }
//     return grouped;
// }


// function getVendorSavings(offers) {
//     // Defensive: Ensure offers is always an array
//     if (!Array.isArray(offers)) offers = [];
//     const prices = offers.map(o => o.price).filter(p => typeof p === "number" && !isNaN(p) && p > 0);
//     if (!prices.length) return { savings_amount: 0, savings_percent: "0%" };
//     const min = Math.min(...prices), max = Math.max(...prices);
//     const savings_amount = max > min ? +(max - min).toFixed(2) : 0;
//     const savings_percent = (max > min) ? `-${Math.round(((max - min) / max) * 100)}%` : "0%";
//     return { savings_amount, savings_percent };
// }

// // --- Main Import Logic ---
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
//         vendors: [],
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

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const rows = [];
//         const vendorsFound = new Set();
//         let rowCount = 0;
//         let totalLines = 0;
//         try {
//             totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         } catch (err) {
//             totalLines = 0;
//         }
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / (importStatus.total || 1)) * 100);

//                 if (row["merchant_name"]) vendorsFound.add(row["merchant_name"].trim());

//                 if (!isValidVendor(row)) return;
//                 const groupKey = getProductKey(row);
//                 if (!groupKey) { importStatus.skipReasons.missingEAN++; importStatus.skipped++; return; }

//                 row["search_price"] = parseSafeNumber(row["search_price"]);
//                 row["store_price"] = parseSafeNumber(row["store_price"]);
//                 row["rrp_price"] = parseSafeNumber(row["rrp_price"]);

//                 rows.push(row);
//             })
//             .on("end", async () => {
//                 importStatus.vendors = Array.from(vendorsFound).sort();

//                 // --- Group all rows by EAN ---
//                 const grouped = groupRowsByProductKey(rows);

//                 const products = {};
//                 for (const groupKey in grouped) {
//                     const vendorRows = grouped[groupKey];

//                     // Category validation ONLY for Reifen.com
//                     if (!isCarTyreGroup(vendorRows)) {
//                         importStatus.skipped++;
//                         importStatus.debugLog.push(`[SKIP] ${groupKey} - No valid Reifen.com car tyre`);
//                         continue;
//                     }

//                     // Prefer Reifen.com row as master, else any
//                     let masterRow = vendorRows.find(
//                         r => (r["merchant_name"] || "").trim().toLowerCase() === "reifen.com"
//                     );
//                     if (!masterRow) masterRow = vendorRows[0];

//                     // Compose offers (one per vendor)
//                     const offers = vendorRows.map(row => ({
//                         vendor: row["merchant_name"],
//                         vendor_id: row["merchant_id"],
//                         brand_name: row["brand_name"],
//                         product_name: row["product_name"],
//                         vendor_logo: findLogo("vendors", row["merchant_name"]),
//                         price: parseSafeNumber(row["search_price"]) || 0,
//                         currency: row["currency"],
//                         aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                         original_affiliate_url: row["aw_deep_link"],
//                         delivery_cost: row["delivery_cost"],
//                         delivery_time: row["delivery_time"],
//                         product_category: row["merchant_product_third_category"],
//                         merchant_deep_link: row["merchant_deep_link"],
//                         in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                     }));

//                     const { width, height, diameter } = parseTyreDimensions(masterRow["dimensions"]);
//                     const { speedIndex, lastIndex } = extractIndexesFromProductName(masterRow["product_name"]);
//                     // Find the cheapest offer for search_price & Zum Angebot
//                     const prices = offers.map(o => o.price).filter(p => p > 0);
//                     const cheapest = Math.min(...prices);
//                     const mostExpensive = Math.max(...prices);

//                     // The offer with the lowest price
//                     const cheapestVendorOffer = offers.find(o => o.price === cheapest);

//                     const mainVendor = masterRow["merchant_name"];
//                     const savings = getVendorSavings(mainVendor, offers);

//                     products[groupKey] = {
//                         ean: masterRow["ean"],
//                         gtin: masterRow["gtin"],
//                         upc: masterRow["upc"],
//                         aw_product_id: masterRow["aw_product_id"],
//                         merchant_product_id: masterRow["merchant_product_id"],
//                         product_name: masterRow["product_name"],
//                         brand_name: masterRow["brand_name"],
//                         brand_logo: findLogo("brands", masterRow["brand_name"]),
//                         category_name: masterRow["category_name"],
//                         category_id: masterRow["category_id"],
//                         product_image: masterRow["merchant_image_url"] || masterRow["aw_image_url"] || masterRow["aw_thumb_url"] || masterRow["large_image"],
//                         description: masterRow["description"],
//                         product_url: masterRow["aw_deep_link"],
//                         currency: masterRow["currency"],
//                         vendor: masterRow["merchant_name"],
//                         merchant_deep_link: masterRow["merchant_deep_link"],
//                         delivery_time: masterRow["delivery_time"],
//                         offers,
//                         savings_percent: savings.savings_percent,
//                         savings_amount: savings.savings_amount,
//                         total_offers: offers.length,
//                         store_price: parseSafeNumber(masterRow["store_price"]),
//                         main_price: parseSafeNumber(masterRow["search_price"]),
//                         rrp_price: parseSafeNumber(masterRow["rrp_price"]),
//                         search_price: cheapest,
//                         cheapest_offer: cheapest,
//                         expensive_offer: mostExpensive,
//                         cheapest_vendor: cheapestVendorOffer ? {
//                             vendor: cheapestVendorOffer.vendor,
//                             vendor_id: cheapestVendorOffer.vendor_id,
//                             vendor_logo: cheapestVendorOffer.vendor_logo,
//                             aw_deep_link: cheapestVendorOffer.original_affiliate_url
//                         } : null,
//                         colour: masterRow["colour"],
//                         product_short_description: masterRow["product_short_description"],
//                         specifications: masterRow["specifications"],
//                         condition: masterRow["condition"],
//                         product_model: masterRow["product_model"],
//                         dimensions: masterRow["dimensions"],
//                         keywords: masterRow["keywords"],
//                         promotional_text: masterRow["promotional_text"],
//                         product_type: masterRow["product_type"],
//                         commission_group: masterRow["commission_group"],
//                         merchant_product_category_path: masterRow["merchant_product_category_path"],
//                         merchant_product_second_category: masterRow["merchant_product_second_category"],
//                         merchant_product_third_category: masterRow["merchant_product_third_category"],
//                         last_updated: masterRow["last_updated"],
//                         in_stock: masterRow["in_stock"] === "1" || masterRow["in_stock"] === 1 || masterRow["in_stock"] === 1.0,
//                         stock_quantity: masterRow["stock_quantity"],
//                         noise_class: masterRow["custom_1"],
//                         wet_grip: masterRow["custom_2"],
//                         fuel_class: masterRow["custom_3"],
//                         delivery_cost: masterRow["delivery_cost"],
//                         mpn: masterRow["mpn"],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date(),
//                         group_key: groupKey,
//                     };
//                 }

//                 // Debug: Vendors for each product
//                 Object.entries(products).forEach(([groupKey, product]) => {
//                     const offerVendors = product.offers.map(o => o.vendor).join(", ");
//                     console.log(`Group ${groupKey}: Vendors = ${offerVendors}`);
//                 });

//                 // --- Bulk DB logic ---
//                 const csvKeys = Object.keys(products);
//                 const existingProducts = await LiveProduct.find({ group_key: { $in: csvKeys } }).lean();
//                 const bulkOps = [];
//                 for (const groupKey of csvKeys) {
//                     const newProd = products[groupKey];
//                     const existing = existingProducts.find(p => p.group_key === groupKey);

//                     // Calculate current offers min/max prices
//                     const prices = newProd.offers.map(o => o.price).filter(p => typeof p === "number" && !isNaN(p) && p > 0);
//                     const cheapest_offer = prices.length ? Math.min(...prices) : 0;
//                     const expensive_offer = prices.length ? Math.max(...prices) : 0;

//                     // Savings logic: always from offers
//                     const savings_amount = expensive_offer > cheapest_offer ? +(expensive_offer - cheapest_offer).toFixed(2) : 0;
//                     const savings_percent = (expensive_offer > cheapest_offer)
//                         ? `-${Math.round(((expensive_offer - cheapest_offer) / expensive_offer) * 100)}%`
//                         : "0%";

//                     // Always update these fields to reflect *current* CSV
//                     newProd.cheapest_offer = cheapest_offer;
//                     newProd.expensive_offer = expensive_offer;
//                     newProd.savings_amount = savings_amount;
//                     newProd.savings_percent = savings_percent;
//                     newProd.search_price = cheapest_offer;

//                     // Display fields (optional)
//                     newProd.cheapest_price_display = (cheapest_offer && !isNaN(cheapest_offer)) ? `${cheapest_offer.toFixed(2).replace('.', ',')} €` : undefined;
//                     newProd.expensive_price_display = (expensive_offer && !isNaN(expensive_offer)) ? `${expensive_offer.toFixed(2).replace('.', ',')} €` : undefined;
//                     newProd.savings_badge = (savings_amount > 0) ? `Spare ${savings_percent}` : undefined;
//                     newProd.offer_count_display = newProd.offers.length > 1 ? `${newProd.offers.length} Angebote` : "1 Angebot";

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${groupKey}`);
//                         continue;
//                     }
//                     const existingOffersSorted = sortOffersByVendorId(existing.offers);
//                     const newOffersSorted = sortOffersByVendorId(newProd.offers);
//                     const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
//                     const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };

//                     if (!isEqual(cleanExisting, cleanNew)) {
//                         const reasons = findChangedFields(existing, newProd);
                       
//                         if (hasNewVendorId(existing.offers || [], newProd.offers)) reasons.push("new_vendor_id");
//                         importStatus.updated++;
//                         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                         importStatus.debugLog.push(`[UPDATE] ${groupKey} - Reasons: ${reasons.join(", ")}`);
//                     } else {
//                         importStatus.skipped++;
//                     }
//                 }
                
//                 // Delete products not in CSV anymore
//                 const csvKeysSet = new Set(csvKeys);
//                 const allDbKeys = (await LiveProduct.find({}, { group_key: 1 }).lean()).map(p => p.group_key);
//                 const toDeleteKeys = allDbKeys.filter(key => !csvKeysSet.has(key));
//                 console.log("Deleting products not in new CSV:", toDeleteKeys);

//                 if (toDeleteKeys.length > 0) {
//                     const deleted = await LiveProduct.deleteMany({ group_key: { $in: toDeleteKeys } });
//                     importStatus.deleted = deleted.deletedCount || 0;
//                 } else {
//                     importStatus.deleted = 0;
//                 }

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

// // --- Exported Endpoints ---
// export function getVendorsFromLastImport(req, res) {
//     res.json({ vendors: importStatus.vendors });
// }
// export async function getVendorsFromDatabase(req, res) {
//     const products = await LiveProduct.find({}, { offers: 1 }).lean();
//     const vendors = new Set();
//     for (const prod of products) {
//         (prod.offers || []).forEach(offer => {
//             if (offer.vendor) vendors.add(offer.vendor);
//         });
//     }
//     res.json({ vendors: Array.from(vendors).sort() });
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
import { VENDOR_PAYMENT_ICONS } from "../utils/vendorPaymentIcons.js";
import isEqual from "lodash.isequal";
import { spawn } from "child_process";
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

// export async function importAWINCsv(filePath) {
//     return new Promise((resolve, reject) => {
//         const rows = [];
//         const vendorsFound = new Set();
//         let rowCount = 0;
//         let totalLines = 0;
//         try {
//             totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//         } catch (err) {
//             totalLines = 0;
//         }
//         importStatus.total = totalLines;

//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", (row) => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / (importStatus.total || 1)) * 100);

//                 if (row["merchant_name"]) vendorsFound.add(row["merchant_name"].trim());

//                 if (!isValidVendor(row)) return;
//                 const groupKey = getProductKey(row);
//                 if (!groupKey) { importStatus.skipReasons.missingEAN++; importStatus.skipped++; return; }

//                 row["search_price"] = parseSafeNumber(row["search_price"]);
//                 row["store_price"] = parseSafeNumber(row["store_price"]);
//                 row["rrp_price"] = parseSafeNumber(row["rrp_price"]);

//                 rows.push(row);
//             })
//             .on("end", async () => {
//                 importStatus.vendors = Array.from(vendorsFound).sort();
//                 console.log("CSV Vendors (merchant_name found in import):", importStatus.vendors);

//                 // --- Group all rows by EAN ---
//                 const grouped = groupRowsByProductKey(rows);
              
//                 console.log("Grouped products by EAN:", Object.keys(grouped).length, "groups found");

//                 const products = {};
//                 for (const groupKey in grouped) {
//                     const vendorRows = grouped[groupKey];

//                     // Category validation ONLY for Reifen.com
//                     if (!isCarTyreGroup(vendorRows)) {
//                         importStatus.skipped++;
//                         importStatus.debugLog.push(`[SKIP] ${groupKey} - No valid Reifen.com car tyre`);
//                         continue;
//                     }

//                     // Prefer Reifen.com row as master, else any
//                     let masterRow = vendorRows.find(
//                         r => (r["merchant_name"] || "").trim().toLowerCase() === "reifen.com"
//                     );
//                     if (!masterRow) masterRow = vendorRows[0];

                   
//                     // Compose offers (one per vendor)
//                     const offers = vendorRows.map(row => ({
//                         vendor: row["merchant_name"],
//                         vendor_id: row["merchant_id"],
//                         brand_name: row["brand_name"],
//                         product_name: row["product_name"],
//                         vendor_logo: findLogo("vendors", row["merchant_name"]),
//                         price: parseSafeNumber(row["search_price"]) || 0,
//                         currency: row["currency"],
//                         payment_icons: VENDOR_PAYMENT_ICONS[row["merchant_name"]] || [],
//                         aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                         original_affiliate_url: row["aw_deep_link"],
//                         delivery_cost: row["delivery_cost"],
//                         delivery_time: row["delivery_time"],
//                         product_category: row["merchant_product_third_category"],
//                         merchant_deep_link: row["merchant_deep_link"],
//                         in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//                     }));

        
//                     const { width, height, diameter } = parseTyreDimensions(masterRow["dimensions"]);
//                     const { speedIndex, lastIndex } = extractIndexesFromProductName(masterRow["product_name"]);
//                     // Find the cheapest offer for search_price & Zum Angebot
//                     const prices = offers.map(o => o.price).filter(p => p > 0);
//                     const cheapest = Math.min(...prices);
//                     const mostExpensive = Math.max(...prices);

//                     // The offer with the lowest price
//                     const cheapestVendorOffer = offers.find(o => o.price === cheapest);

//                     const savings = getVendorSavings(offers);

//                     products[groupKey] = {
//                         ean: normalizeEAN(masterRow["ean"]),
//                         gtin: masterRow["gtin"],
//                         upc: masterRow["upc"],
//                         aw_product_id: masterRow["aw_product_id"],
//                         merchant_product_id: masterRow["merchant_product_id"],
//                         product_name: masterRow["product_name"],
//                         brand_name: masterRow["brand_name"],
//                         brand_logo: findLogo("brands", masterRow["brand_name"]),
//                         category_name: masterRow["category_name"],
//                         category_id: masterRow["category_id"],
//                         product_image: masterRow["merchant_image_url"] || masterRow["aw_image_url"] || masterRow["aw_thumb_url"] || masterRow["large_image"] || masterRow["alternate_image"] || masterRow["alternate_image_two"] || masterRow["alternate_image_three"] || masterRow["alternate_image_four"],
//                         description: masterRow["description"],
//                         product_affiliate_url: masterRow["aw_deep_link"],
//                         product_url: cheapestVendorOffer ? cheapestVendorOffer.original_affiliate_url : masterRow["aw_deep_link"],
//                         currency: masterRow["currency"],
//                         vendor: masterRow["merchant_name"],
//                         merchant_deep_link: masterRow["merchant_deep_link"],
//                         delivery_time: masterRow["delivery_time"],
//                         offers,
//                         savings_percent: savings.savings_percent,
//                         savings_amount: savings.savings_amount,
//                         total_offers: offers.length,
//                         store_price: parseSafeNumber(masterRow["store_price"]),
//                         main_price: parseSafeNumber(masterRow["search_price"]),
//                         rrp_price: parseSafeNumber(masterRow["rrp_price"]),
//                         search_price: cheapest,
//                         cheapest_offer: cheapest,
//                         expensive_offer: mostExpensive,
//                         payment_methods: cheapestVendorOffer ? cheapestVendorOffer.payment_icons : [],
//                         cheapest_vendor: cheapestVendorOffer ? {
//                             vendor: cheapestVendorOffer.vendor,
//                             vendor_id: cheapestVendorOffer.vendor_id,
//                             vendor_logo: cheapestVendorOffer.vendor_logo,
//                             aw_deep_link: cheapestVendorOffer.original_affiliate_url,
//                             payment_icons: cheapestVendorOffer.payment_icons
//                         } : null,
//                         colour: masterRow["colour"],
//                         product_short_description: masterRow["product_short_description"],
//                         specifications: masterRow["specifications"],
//                         condition: masterRow["condition"],
//                         product_model: masterRow["product_model"],
//                         dimensions: masterRow["dimensions"],
//                         keywords: masterRow["keywords"],
//                         promotional_text: masterRow["promotional_text"],
//                         product_type: masterRow["product_type"],
//                         commission_group: masterRow["commission_group"],
//                         merchant_product_category_path: masterRow["merchant_product_category_path"],
//                         merchant_product_second_category: masterRow["merchant_product_second_category"],
//                         merchant_product_third_category: masterRow["merchant_product_third_category"],
//                         last_updated: masterRow["last_updated"],
//                         in_stock: masterRow["in_stock"] === "1" || masterRow["in_stock"] === 1 || masterRow["in_stock"] === 1.0,
//                         stock_quantity: masterRow["stock_quantity"],
//                         noise_class: masterRow["custom_1"],
//                         wet_grip: masterRow["custom_2"],
//                         fuel_class: masterRow["custom_3"],
//                         delivery_cost: masterRow["delivery_cost"],
//                         mpn: masterRow["mpn"],
//                         width,
//                         height,
//                         diameter,
//                         speedIndex,
//                         lastIndex,
//                         last_imported_at: new Date(),
//                         group_key: groupKey, // still set for reference but NOT used for matching/updating/deleting
//                     };
//                 }
//                 // console.log(`✔️ Cloudinary upload complete: ${cloudUploadCount} / ${totalToUpload} products uploaded to Cloudinary.`);

//                 // --- Bulk DB logic by EAN ---
//                 const csvEanList = Object.keys(products); // these are already normalized
//                 // Build a fast lookup of existing DB products by EAN
//                 const allDbProducts = await LiveProduct.find({ ean: { $in: csvEanList } }).lean();
//                 const dbEanToProduct = {};
//                 allDbProducts.forEach(prod => {
//                     if (prod.ean) dbEanToProduct[normalizeEAN(prod.ean)] = prod;
//                 });

//                 const bulkOps = [];
//                 for (const ean of csvEanList) {
//                     const newProd = products[ean];
//                     const existing = dbEanToProduct[ean];

//                     // Calculate current offers min/max prices
//                     const prices = newProd.offers.map(o => o.price).filter(p => typeof p === "number" && !isNaN(p) && p > 0);
//                     const cheapest_offer = prices.length ? Math.min(...prices) : 0;
//                     const expensive_offer = prices.length ? Math.max(...prices) : 0;

//                     // Savings logic: always from offers
//                     const savings_amount = expensive_offer > cheapest_offer ? +(expensive_offer - cheapest_offer).toFixed(2) : 0;
//                     const savings_percent = (expensive_offer > cheapest_offer)
//                         ? `-${Math.round(((expensive_offer - cheapest_offer) / expensive_offer) * 100)}%`
//                         : "0%";

//                     // Always update these fields to reflect *current* CSV  
//                     newProd.cheapest_offer = cheapest_offer;
//                     newProd.expensive_offer = expensive_offer;
//                     newProd.savings_amount = savings_amount;
//                     newProd.savings_percent = savings_percent;
//                     newProd.search_price = cheapest_offer;

//                     // Display fields (optional)
//                     newProd.cheapest_price_display = (cheapest_offer && !isNaN(cheapest_offer)) ? `${cheapest_offer.toFixed(2).replace('.', ',')} €` : undefined;
//                     newProd.expensive_price_display = (expensive_offer && !isNaN(expensive_offer)) ? `${expensive_offer.toFixed(2).replace('.', ',')} €` : undefined;
//                     newProd.savings_badge = (savings_amount > 0) ? `Spare ${savings_percent}` : undefined;
//                     newProd.offer_count_display = newProd.offers.length > 1 ? `${newProd.offers.length} Angebote` : "1 Angebot";

//                     if (!existing) {
//                         importStatus.imported++;
//                         bulkOps.push({ insertOne: { document: newProd } });
//                         importStatus.debugLog.push(`[INSERT] ${ean}`);
//                         continue;
//                     }
//                     const existingOffersSorted = sortOffersByVendorId(existing.offers);
//                     const newOffersSorted = sortOffersByVendorId(newProd.offers);
//                     const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted };
//                     const cleanNew = { ...stripIgnoredFields(newProd), offers: newOffersSorted };

//                     if (!isEqual(cleanExisting, cleanNew)) {
//                         const reasons = findChangedFields(existing, newProd);
//                         if (hasNewVendorId(existing.offers || [], newProd.offers)) reasons.push("new_vendor_id");
//                         importStatus.updated++;
//                         bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: newProd } } });
//                         importStatus.debugLog.push(`[UPDATE] ${ean} - Reasons: ${reasons.join(", ")}`);
//                     } else {
//                         importStatus.skipped++;
//                     }
//                 }

//                 // --- Delete products not in CSV anymore (by EAN, not group_key) ---
//                 const csvEanSet = new Set(csvEanList);
//                 // Fetch all DB EANs (normalized, skip blanks)
//                 const allDbEans = (await LiveProduct.find({}, { ean: 1 })).map(p => normalizeEAN(p.ean)).filter(Boolean);
//                 const toDeleteEans = allDbEans.filter(dbEan => !csvEanSet.has(dbEan));
//                 console.log("Deleting products not in new CSV (by EAN):", toDeleteEans);

//                 if (toDeleteEans.length > 0) {
//                     const deleted = await LiveProduct.deleteMany({ ean: { $in: toDeleteEans } });
//                     importStatus.deleted = deleted.deletedCount || 0;
//                 } else {
//                     importStatus.deleted = 0;
//                 }

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

// const BATCH_SIZE = 1000;

// export async function importAWINCsv(filePath) {
  

//     let rows = [];
//     let vendorsFound = new Set();
//     let rowCount = 0;
//     let totalLines = 0;
//     try {
//         totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
//     } catch { totalLines = 0; }
//     importStatus.total = totalLines;

//     // 1. Read all rows into memory
//     await new Promise((resolve, reject) => {
//         fs.createReadStream(filePath)
//             .pipe(csv({ separator: ";" }))
//             .on("data", row => {
//                 rowCount++;
//                 importStatus.progress = Math.round((rowCount / (importStatus.total || 1)) * 100);

//                 if (row["merchant_name"]) vendorsFound.add(row["merchant_name"].trim());
//                 if (!isValidVendor(row)) return;
//                 row["search_price"] = parseSafeNumber(row["search_price"]);
//                 row["store_price"] = parseSafeNumber(row["store_price"]);
//                 row["rrp_price"] = parseSafeNumber(row["rrp_price"]);
//                 rows.push(row);
//             })
//             .on("end", resolve)
//             .on("error", err => {
//                 importStatus.error = err.message;
//                 importStatus.done = true;
//                 reject(err);
//             });
//     });

//     // 2. Group by EAN
//     const grouped = {};
//     for (const row of rows) {
//         const ean = normalizeEAN(row["ean"]);
//         if (!ean) continue;
//         if (!grouped[ean]) grouped[ean] = [];
//         grouped[ean].push(row);
//     }
//     const allEans = Object.keys(grouped);
//     importStatus.vendors = Array.from(vendorsFound).sort();
//     importStatus.groupCount = allEans.length;
//     let batchCount = 0;

//     // 3. Process in batches
//     for (let i = 0; i < allEans.length; i += BATCH_SIZE) {
//         const batchEans = allEans.slice(i, i + BATCH_SIZE);
//         const products = {};

//         for (const ean of batchEans) {
//             const vendorRows = grouped[ean];
//             if (!isCarTyreGroup(vendorRows)) {
//                 importStatus.skipped++;
//                 importStatus.debugLog.push(`[SKIP] ${ean} - No valid Reifen.com car tyre`);
//                 continue;
//             }
//             let masterRow = vendorRows.find(r => (r["merchant_name"] || "").trim().toLowerCase() === "reifen.com");
//             if (!masterRow) masterRow = vendorRows[0];

//             const offers = vendorRows.map(row => ({
//                 vendor: row["merchant_name"],
//                 vendor_id: row["merchant_id"],
//                 brand_name: row["brand_name"],
//                 product_name: row["product_name"],
//                 vendor_logo: findLogo("vendors", row["merchant_name"]),
//                 price: parseSafeNumber(row["search_price"]) || 0,
//                 currency: row["currency"],
//                 payment_icons: VENDOR_PAYMENT_ICONS[row["merchant_name"]] || [],
//                 aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
//                 original_affiliate_url: row["aw_deep_link"],
//                 delivery_cost: row["delivery_cost"],
//                 delivery_time: row["delivery_time"],
//                 product_category: row["merchant_product_third_category"],
//                 merchant_deep_link: row["merchant_deep_link"],
//                 in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
//             }));

//             const { width, height, diameter } = parseTyreDimensions(masterRow["dimensions"]);
//             const { speedIndex, lastIndex } = extractIndexesFromProductName(masterRow["product_name"]);
//             const prices = offers.map(o => o.price).filter(p => p > 0);
//             const cheapest = prices.length ? Math.min(...prices) : 0;
//             const mostExpensive = prices.length ? Math.max(...prices) : 0;
//             const cheapestVendorOffer = offers.find(o => o.price === cheapest);
//             const savings = getVendorSavings(offers);

//             products[ean] = {
//                 ean: normalizeEAN(masterRow["ean"]),
//                 gtin: masterRow["gtin"],
//                 upc: masterRow["upc"],
//                 aw_product_id: masterRow["aw_product_id"],
//                 merchant_product_id: masterRow["merchant_product_id"],
//                 product_name: masterRow["product_name"],
//                 brand_name: masterRow["brand_name"],
//                 brand_logo: findLogo("brands", masterRow["brand_name"]),
//                 category_name: masterRow["category_name"],
//                 category_id: masterRow["category_id"],
//                 product_image: masterRow["merchant_image_url"] || masterRow["aw_image_url"] || masterRow["aw_thumb_url"] || masterRow["large_image"] || masterRow["alternate_image"] || masterRow["alternate_image_two"] || masterRow["alternate_image_three"] || masterRow["alternate_image_four"],
//                 description: masterRow["description"],
//                 product_affiliate_url: masterRow["aw_deep_link"],
//                 product_url: cheapestVendorOffer ? cheapestVendorOffer.original_affiliate_url : masterRow["aw_deep_link"],
//                 currency: masterRow["currency"],
//                 vendor: masterRow["merchant_name"],
//                 merchant_deep_link: masterRow["merchant_deep_link"],
//                 delivery_time: masterRow["delivery_time"],
//                 offers,
//                 savings_percent: savings.savings_percent,
//                 savings_amount: savings.savings_amount,
//                 total_offers: offers.length,
//                 store_price: parseSafeNumber(masterRow["store_price"]),
//                 main_price: parseSafeNumber(masterRow["search_price"]),
//                 rrp_price: parseSafeNumber(masterRow["rrp_price"]),
//                 search_price: cheapest,
//                 cheapest_offer: cheapest,
//                 expensive_offer: mostExpensive,
//                 payment_methods: cheapestVendorOffer ? cheapestVendorOffer.payment_icons : [],
//                 cheapest_vendor: cheapestVendorOffer ? {
//                     vendor: cheapestVendorOffer.vendor,
//                     vendor_id: cheapestVendorOffer.vendor_id,
//                     vendor_logo: cheapestVendorOffer.vendor_logo,
//                     aw_deep_link: cheapestVendorOffer.original_affiliate_url,
//                     payment_icons: cheapestVendorOffer.payment_icons
//                 } : null,
//                 colour: masterRow["colour"],
//                 product_short_description: masterRow["product_short_description"],
//                 specifications: masterRow["specifications"],
//                 condition: masterRow["condition"],
//                 product_model: masterRow["product_model"],
//                 dimensions: masterRow["dimensions"],
//                 keywords: masterRow["keywords"],
//                 promotional_text: masterRow["promotional_text"],
//                 product_type: masterRow["product_type"],
//                 commission_group: masterRow["commission_group"],
//                 merchant_product_category_path: masterRow["merchant_product_category_path"],
//                 merchant_product_second_category: masterRow["merchant_product_second_category"],
//                 merchant_product_third_category: masterRow["merchant_product_third_category"],
//                 last_updated: masterRow["last_updated"],
//                 in_stock: masterRow["in_stock"] === "1" || masterRow["in_stock"] === 1 || masterRow["in_stock"] === 1.0,
//                 stock_quantity: masterRow["stock_quantity"],
//                 noise_class: masterRow["custom_1"],
//                 wet_grip: masterRow["custom_2"],
//                 fuel_class: masterRow["custom_3"],
//                 delivery_cost: masterRow["delivery_cost"],
//                 mpn: masterRow["mpn"],
//                 width,
//                 height,
//                 diameter,
//                 speedIndex,
//                 lastIndex,
//                 last_imported_at: new Date(),
//                 group_key: ean,
//             };
//         }

//         // Bulk DB update for this batch
//         const existingProducts = await LiveProduct.find({ ean: { $in: batchEans } }).lean();
//         const dbMap = {};
//         existingProducts.forEach(prod => { if (prod.ean) dbMap[normalizeEAN(prod.ean)] = prod; });

//         const bulkOps = [];
//         let inserted = 0, updated = 0, skipped = 0;
//         for (const ean of batchEans) {
//             const newProd = products[ean];
//             const existing = dbMap[ean];
//             if (!newProd) continue;

//             if (!existing) {
//                 bulkOps.push({ insertOne: { document: newProd } });
//                 inserted++;
//                 importStatus.imported++;
//                 importStatus.debugLog.push(`[INSERT] ${ean}`);
//             } else {
//                 // preserve old image (do not overwrite with CSV!)
//                 const updateProd = { ...newProd, product_image: existing.product_image };
//                 const existingOffersSorted = sortOffersByVendorId(existing.offers || []);
//                 const newOffersSorted = sortOffersByVendorId(updateProd.offers);
//                 const cleanExisting = { ...stripIgnoredFields(existing), offers: existingOffersSorted, product_image: existing.product_image };
//                 const cleanNew = { ...stripIgnoredFields(updateProd), offers: newOffersSorted, product_image: existing.product_image };
//                 if (!isEqual(cleanExisting, cleanNew)) {
//                     bulkOps.push({ updateOne: { filter: { _id: existing._id }, update: { $set: updateProd } } });
//                     updated++;
//                     importStatus.updated++;
//                     importStatus.debugLog.push(`[UPDATE] ${ean}`);
//                 } else {
//                     skipped++;
//                     importStatus.skipped++;
//                 }
//             }
//         }
//         if (bulkOps.length) await LiveProduct.bulkWrite(bulkOps);
//         batchCount++;
//         console.log(`Batch ${batchCount} (${i + 1}-${i + batchEans.length}): Inserted ${inserted}, Updated ${updated}, Skipped ${skipped}`);
//     }

//     // 4. Deletion logic (remove products not in latest import)
//     const allDbEans = (await LiveProduct.find({}, { ean: 1 })).map(p => normalizeEAN(p.ean)).filter(Boolean);
//     const importedEanSet = new Set(allEans);
//     const toDeleteEans = allDbEans.filter(dbEan => !importedEanSet.has(dbEan));
//     if (toDeleteEans.length) {
//         const deleted = await LiveProduct.deleteMany({ ean: { $in: toDeleteEans } });
//         importStatus.deleted = deleted.deletedCount || 0;
//         console.log(`Deleted ${deleted.deletedCount} products not in CSV`);
//     } else {
//         importStatus.deleted = 0;
//         console.log(`No obsolete products to delete`);
//     }

//     importStatus.done = true;
//     importStatus.finishedAt = new Date();
//     importStatus.progress = 100;
//     console.log(`✅ Import done. Total EAN groups: ${allEans.length}, Batches: ${batchCount}, Vendors found: ${[...vendorsFound].join(", ")}`);
//     spawn("node", ["src/api/utils/uploadProductImages.js"], { stdio: "inherit" });
// }


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

                        const offers = vendorRows.map(row => ({
                            vendor: row["merchant_name"],
                            vendor_id: row["merchant_id"],
                            brand_name: row["brand_name"],
                            product_name: row["product_name"],
                            vendor_logo: findLogo("vendors", row["merchant_name"]),
                            price: parseSafeNumber(row["search_price"]) || 0,
                            currency: row["currency"],
                            payment_icons: VENDOR_PAYMENT_ICONS[row["merchant_name"]] || [],
                            aw_deep_link: `/go/${row["aw_product_id"]}?from=reifendb`,
                            original_affiliate_url: row["aw_deep_link"],
                            delivery_cost: row["delivery_cost"],
                            delivery_time: row["delivery_time"],
                            product_category: row["merchant_product_third_category"],
                            merchant_deep_link: row["merchant_deep_link"],
                            in_stock: row["in_stock"] === "1" || row["in_stock"] === 1 || row["in_stock"] === 1.0,
                        }));

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
                    // spawn("node", ["src/api/utils/uploadProductImages.js"], { stdio: "inherit" });
                // only trigger Cloudinary upload if there are new reifen.com images
                if (cloudinaryUploadQueue.size > 0) {
                    spawn("node", ["src/api/utils/uploadProductImages.js"], { stdio: "inherit" });
                }
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
