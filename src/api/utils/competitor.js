// utils/competitor.js

import Product from '../../models/product.js'; 

// Strict match: All key fields for maximum similarity
function buildStrictMatch(product) {
    const match = {
        merchant_product_third_category: product.merchant_product_third_category,
        product_category: product.product_category,
        width: product.width,
        height: product.height,
        diameter: product.diameter,
        speedIndex: product.speedIndex,
        lastIndex: product.lastIndex,
        _id: { $ne: product._id }
    };
    Object.keys(match).forEach(k => (match[k] == null || match[k] === "") && delete match[k]);
    return match;
}

// Broad match: Category & key dimensions (wider pool if not enough)
function buildBroadMatch(product) {
    const match = {
        merchant_product_third_category: product.merchant_product_third_category,
        product_category: product.product_category,
        width: product.width,
        diameter: product.diameter,
        _id: { $ne: product._id }
    };
    Object.keys(match).forEach(k => (match[k] == null || match[k] === "") && delete match[k]);
    return match;
}

/**
 * Returns up to `maxCount` competitor products for a given product.
 * 1. Tries strict filter (unique by brand, sorted by price).
 * 2. If not enough, widens the filter to fill up to `maxCount`.
 * 
 * @param {Object} product - The product to find competitors for.
 * @param {Number} maxCount - Maximum number of competitors.
 * @returns {Promise<Array>}
 */
export async function getCompetitors(product, maxCount = 3) {
    // 1. Strict match
    let related = await Product.find(buildStrictMatch(product))
        .sort({ search_price: 1 })
        .select("_id brand_name product_name product_url search_price")
        .lean();

    // Unique by brand
    const brandMap = new Map();
    for (const p of related) {
        if (!p.brand_name) continue;
        if (
            !brandMap.has(p.brand_name) ||
            (typeof p.search_price === 'number' && p.search_price < brandMap.get(p.brand_name).search_price)
        ) {
            brandMap.set(p.brand_name, p);
        }
    }
    let competitorsList = Array.from(brandMap.values()).slice(0, maxCount);

    // 2. Broaden filter if < maxCount
    if (competitorsList.length < maxCount) {
        const broad = await Product.find(buildBroadMatch(product))
            .sort({ search_price: 1 })
            .select("_id brand_name product_name product_url search_price")
            .lean();

        for (const p of broad) {
            if (
                competitorsList.length < maxCount &&
                !competitorsList.some(r => String(r._id) === String(p._id))
            ) {
                competitorsList.push(p);
            }
        }
    }

    return competitorsList.slice(0, maxCount).map(r => ({
        _id: r._id,
        brand_name: r.brand_name,
        product_name: r.product_name,
        url: r.product_url,
        price: typeof r.search_price === "number"
            ? r.search_price.toFixed(2).replace(".", ",")
            : "0,00",
    }));
}
