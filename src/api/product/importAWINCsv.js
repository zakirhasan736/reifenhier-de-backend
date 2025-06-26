import fs from "fs";
import csv from "csv-parser";
import Product from "../../models/product.js"; // Your Mongoose model
import { findLogo } from "../utils/logoFinder.js"; // Import the findLogo function
import isEqual from "lodash.isequal";

let importStatus = {
    running: false, done: false, progress: 0, total: 0,
    imported: 0, skipped: 0, error: null, startedAt: null, finishedAt: null, filename: ""
};

// Async "fire and forget" wrapper
export function startCsvImportAsync(filePath) {
    importStatus = { running: true, done: false, progress: 0, total: 0, imported: 0, skipped: 0, error: null, startedAt: new Date(), finishedAt: null, filename: filePath };
    // Don’t await: runs in background!
    importAWINCsv(filePath)
        .catch(err => { importStatus.error = err.message || String(err); })
        .finally(() => { importStatus.running = false; importStatus.done = true; importStatus.finishedAt = new Date(); });
}

// Function to parse tyre dimensions
const parseTyreDimensions = (dim) => {
    if (!dim) return { width: '', height: '', diameter: '' };
    const match =
        dim.match(/^(\d+)[ /-](\d+)[ /-]R\s?(\d+)$/i) ||
        dim.match(/^(\d+)[ /-](\d+)[ /-](\d+)$/i) ||
        dim.match(/^(\d+)\/(\d+)R(\d+)$/i) ||
        dim.match(/^(\d+)\/(\d+)\/?R?(\d+)$/i);
    if (match) {
        return { width: match[1], height: match[2], diameter: match[3] };
    }
    const rMatch = dim.match(/R\s?(\d+)/i);
    const parts = dim.match(/\d+/g) || [];
    return {
        width: parts[0] || '',
        height: parts[1] || '',
        diameter: rMatch ? rMatch[1] : parts[2] || '',
    };
};

// Function to extract speed index and last index from product name
const extractIndexesFromProductName = (productName) => {
    const matches = productName.match(/\b(\d{2,3})([A-Z]{1,2})\b/g) || [];
    const rIdx = productName.search(/\bR\d+\b/i);
    if (rIdx === -1) return { lastIndex: '', speedIndex: '' };
    const tail = productName.substring(rIdx + 2); // skip "R" and digits
    const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
    if (idxMatch) {
        return { lastIndex: idxMatch[1], speedIndex: idxMatch[2] };
    }
    if (matches.length > 0) {
        const m = matches[0].match(/(\d{2,3})([A-Z]{1,2})/);
        if (m) return { lastIndex: m[1], speedIndex: m[2] };
    }
    return { lastIndex: '', speedIndex: '' };
};

export async function importAWINCsv(filePath) {
    return new Promise((resolve, reject) => {
        const products = {};
        let imported = 0, skipped = 0;
        let headerLogged = false;
        let rowCount = 0;

        // Pre-count lines for progress
        const totalLines = fs.readFileSync(filePath, "utf8").split(/\r?\n/).length - 1;
        importStatus.total = totalLines > 0 ? totalLines : 0;

        fs.createReadStream(filePath)
            .pipe(csv({ separator: ";" }))
            .on("data", (row) => {
                rowCount++;
                importStatus.progress = Math.round((rowCount / importStatus.total) * 100);

                if (!headerLogged) {
                    console.log("Parsed CSV header keys:", Object.keys(row));
                    headerLogged = true;
                }

                // Defensive: Clean vendor/category
                const vendor = (row["merchant_name"] || "").toLowerCase().replace(/\s|\./g, "");
                const cat = (row["merchant_product_second_category"] || "").toLowerCase();
                if (vendor !== 'reifencom') return;
                if (!cat.includes('reifen')) return;
                const vendorName = row["merchant_name"];
                const vendorLogo = findLogo("vendors", vendorName);  // Get the vendor logo using the findLogo function

                // Parse dimensions and extract speed index and last index
                const { width, height, diameter } = parseTyreDimensions(row["dimensions"] || '');
                const { speedIndex, lastIndex } = extractIndexesFromProductName(row["product_name"] || '');

                const offerObj = {
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
                    product_category: row["merchant_product_third_category"],
                    merchant_deep_link: row["merchant_deep_link"],
                    in_stock: row["in_stock"] === "1",
                };

                const ean = row["ean"] || row["aw_product_id"];
                if (!ean || ean.trim() === "") return;

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
                        product_image: row["merchant_image_url"] || row["aw_image_url"] || row["aw_thumb_url"] || row["large_image"] || row["alternate_image"] || row["alternate_image_two"] || row["alternate_image_three"] || row["alternate_image_four"],
                        description: row["description"],
                        merchant_category: row["merchant_category"],
                        search_price: row["search_price"],
                        product_url: row["aw_deep_link"],
                        currency: row["currency"],
                        store_price: row["store_price"],
                        colour: row["colour"],
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
                        rrp_price: row["rrp_price"],
                        saving: row["saving"],
                        savings_percent: row["savings_percent"],
                        base_price: row["base_price"],
                        base_price_amount: row["base_price_amount"],
                        base_price_text: row["base_price_text"],
                        product_price_old: row["product_price_old"],
                        delivery_restrictions: row["delivery_restrictions"],
                        delivery_weight: row["delivery_weight"],
                        warranty: row["warranty"],
                        terms_of_contract: row["terms_of_contract"],
                        delivery_time: row["delivery_time"],
                        valid_from: row["valid_from"],
                        valid_to: row["valid_to"],
                        is_for_sale: row["is_for_sale"],
                        web_offer: row["web_offer"],
                        pre_order: row["pre_order"],
                        stock_status: row["stock_status"],
                        size_stock_status: row["size_stock_status"],
                        size_stock_amount: row["size_stock_amount"],
                        in_stock: row["in_stock"],
                        stock_quantity: row["stock_quantity"],
                        reviews: row["reviews"],
                        average_rating: row["average_rating"],
                        rating: row["rating"],
                        number_available: row["number_available"],
                        noise_class: row["custom_1"],
                        wet_grip: row["custom_2"],
                        fuel_class: row["custom_3"],
                        custom_4: row["custom_4"],
                        custom_5: row["custom_5"],
                        custom_6: row["custom_6"],
                        custom_7: row["custom_7"],
                        custom_8: row["custom_8"],
                        custom_9: row["custom_9"],
                        isbn: row["isbn"],
                        upc: row["upc"],
                        mpn: row["mpn"],
                        parent_product_id: row["parent_product_id"],
                        product_GTIN: row["product_GTIN"],
                        basket_link: row["basket_link"],
                        last_updated: row["last_updated"],
                        merchant_thumb_url: row["merchant_thumb_url"],
                        large_image: row["large_image"],
                        alternate_image: row["alternate_image"],
                        aw_thumb_url: row["aw_thumb_url"],
                        alternate_image_two: row["alternate_image_two"],
                        alternate_image_three: row["alternate_image_three"],
                        alternate_image_four: row["alternate_image_four"],
                        last_imported_at: new Date(),
                        offers: [offerObj],
                        width: width, // Or store width here, depending on your column and data
                        height: height,
                        diameter: diameter,
                        speedIndex: speedIndex,  // Store speedIndex
                        lastIndex: lastIndex   // Store lastIndex
                    };
                } else {
                    if (!products[ean].offers.some(o => o.vendor_id === offerObj.vendor_id)) {
                        products[ean].offers.push(offerObj);
                    }
                }
            })
            .on("end", async () => {
                const csvEANs = Object.keys(products);
                await Product.deleteMany({ ean: { $nin: csvEANs } });
                await Product.deleteMany({ ean: { $in: [null, ""] } });

                for (const ean of csvEANs) {
                    const newData = products[ean];
                    const existing = await Product.findOne({ ean });

                    if (existing) {
                        const plainExisting = JSON.parse(JSON.stringify(existing));
                        delete plainExisting._id;
                        delete plainExisting.__v;
                        if (isEqual(newData, plainExisting)) {
                            skipped++;
                            continue;
                        }
                    }

                    await Product.findOneAndUpdate(
                        { ean },
                        newData,
                        { upsert: true, new: true }
                    );
                    imported++;
                }
                importStatus.imported = imported;
                importStatus.skipped = skipped;
                importStatus.progress = 100;
                console.log(`Finished. Imported: ${imported}, Skipped: ${skipped}`);
                resolve();
            })
            .on("error", err => {
                importStatus.error = err.message || String(err);
                reject(err);
            });
    });
}


// Progress endpoint logic
export function getImportProgress(req, res) {
    res.json(importStatus);
}