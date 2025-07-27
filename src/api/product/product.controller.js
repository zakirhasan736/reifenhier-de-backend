import FeaturedSettings from '../../models/FeaturedSettings.js';
import Product from '../../models/product.js';
import { startCsvImportAsync } from "./importAWINCsv.js";
// import { getCompetitors } from '../utils/competitor.js';


export const productLists = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            sort = "createdAt",
            order = "desc",
        } = req.query;

        const toArray = (val) =>
            Array.isArray(val)
                ? val
                : val
                    ? typeof val === "string"
                        ? val.split(",").filter(Boolean)
                        : [val]
                    : [];

        // Build filters for main product search
        const filters = {
            ...(req.query.category && {
                merchant_product_third_category: { $in: toArray(req.query.category) },
            }),
            ...(req.query.brand && {
                brand_name: { $in: toArray(req.query.brand) },
            }),
            ...(req.query.width && {
                width: { $in: toArray(req.query.width) },
            }),
            ...(req.query.height && {
                height: { $in: toArray(req.query.height) },
            }),
            ...(req.query.diameter && {
                diameter: { $in: toArray(req.query.diameter) },
            }),
            ...(req.query.speedIndex && {
                speedIndex: { $in: toArray(req.query.speedIndex) },
            }),
            ...(req.query.lastIndex && {
                lastIndex: { $in: toArray(req.query.lastIndex) },
            }),
            ...(req.query.noise && {
                noise_class: { $in: toArray(req.query.noise) },
            }),
            ...(req.query.fuelClass && {
                fuel_class: { $in: toArray(req.query.fuelClass) },
            }),
            ...(req.query.wetGrip && {
                wet_grip: { $in: toArray(req.query.wetGrip) },
            }),
        };

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOption = { [sort]: order === "asc" ? 1 : -1 };

        // Faceted search (filters)
        const fieldMap = {
            categories: "merchant_product_third_category",
            brands: "brand_name",
            widths: "width",
            heights: "height",
            diameters: "diameter",
            speedIndexes: "speedIndex",
            lastIndexes: "lastIndex",
            noises: "noise_class",
            fuelClasses: "fuel_class",
            wetGrips: "wet_grip",
        };

        const facetStage = {};
        for (const [facetName, field] of Object.entries(fieldMap)) {
            const filterCopy = { ...filters };
            delete filterCopy[field];
            facetStage[facetName] = [
                { $match: filterCopy },
                { $group: { _id: `$${field}`, count: { $sum: 1 } } },
                { $project: { name: "$_id", count: 1, _id: 0 } },
            ];
        }

        facetStage.prices = [
            { $match: filters },
            {
                $group: {
                    _id: null,
                    min: { $min: "$search_price" },
                    max: { $max: "$search_price" },
                },
            },
        ];

        // 1. Fetch main products
        const [productsRaw, total, agg] = await Promise.all([
            Product.find(filters)
                .sort(sortOption)
                .skip(skip)
                .limit(+limit)
                .select(
                    "brand_logo fuel_class related_cheaper in_stock product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price main_price merchant_product_category_path merchant_product_second_category cheapest_offer expensive_offer speedIndex lastIndex width height diameter ean offers savings_percent total_offers average_rating review_count"
                )
                .lean(),
            Product.countDocuments(filters),
            Product.aggregate([{ $facet: facetStage }]),
        ]);

        // Now use the reusable function per product:
        const products = await Promise.all(productsRaw.map(async (product) => ({
            ...product,
            cheapest_offer: typeof product.cheapest_offer === "number"
                ? `${product.cheapest_offer.toFixed(2).replace(".", ",")}`
                : product.cheapest_offer || "0,00",
            expensive_offer: typeof product.expensive_offer === "number"
                ? `${product.expensive_offer.toFixed(2).replace(".", ",")}`
                : product.expensive_offer || "0,00",
            search_price: typeof product.search_price === "number"
                ? `${product.search_price.toFixed(2).replace(".", ",")}`
                : product.search_price || "0,00",
            main_price: typeof product.main_price === "number"
                ? `${product.main_price.toFixed(2).replace(".", ",")}`
                : product.main_price || "0,00",
            savings_percent: product.savings_percent || "0%",
            total_offers: product.total_offers || (product.offers?.length || 1),
            zum_angebot_url: product.offers?.[0]?.aw_deep_link || "",
            vendor_name: product.offers?.[0]?.vendor || "",
            vendor_logo: product.offers?.[0]?.vendor_logo || "",
            // related_cheaper: await getCompetitors(product, 3)
        })));

        const result = agg[0] || {};
        const priceData = result.prices?.[0] || { min: 0, max: 0 };

        return res.status(200).json({
            total,
            products,
            minPrices: priceData.min,
            maxPrices: priceData.max,
            filterGroups: {
                categories: result.categories || [],
                brands: result.brands || [],
                widths: result.widths || [],
                heights: result.heights || [],
                diameters: result.diameters || [],
                speedIndexes: result.speedIndexes || [],
                lastIndexes: result.lastIndexes || [],
                noises: result.noises || [],
                fuelClasses: result.fuelClasses || [],
                wetGrips: result.wetGrips || [],
            },
        });
    } catch (err) {
        console.error("Error in productLists:", err);
        return res.status(500).json({ message: "Server error" });
    }
};


// ========================================
const relatedProductsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes TTL

// Cache helper
const getCachedRelatedProducts = (key) => {
    const entry = relatedProductsCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        relatedProductsCache.delete(key);
        return null;
    }
    return entry.data;
};

const setCachedRelatedProducts = (key, data) => {
    relatedProductsCache.set(key, { data, timestamp: Date.now() });
};
// --- UTIL: Price formatting ---
function formatPrice(value) {
    if (typeof value === "number") return value.toFixed(2).replace(".", ",");
    if (!value || value === "-") return "0,00";
    const n = parseFloat(value);
    if (!isNaN(n)) return n.toFixed(2).replace(".", ",");
    return "0,00";
}  
  
// export const getProductDetails = async (req, res) => {
//     const { productId } = req.params;

//     // Utils
//     const parseTyreDimensions = (dim) => {
//         if (!dim) return { width: '', height: '', diameter: '' };
//         const match =
//             dim.match(/^(\d+)[ /-](\d+)[ /-]R\s?(\d+)$/i) ||
//             dim.match(/^(\d+)[ /-](\d+)[ /-](\d+)$/i) ||
//             dim.match(/^(\d+)\/(\d+)R(\d+)$/i) ||
//             dim.match(/^(\d+)\/(\d+)\/?R?(\d+)$/i);
//         if (match) return { width: match[1], height: match[2], diameter: match[3] };

//         const rMatch = dim.match(/R\s?(\d+)/i);
//         const parts = dim.match(/\d+/g) || [];
//         return {
//             width: parts[0] || '',
//             height: parts[1] || '',
//             diameter: rMatch ? rMatch[1] : parts[2] || '',
//         };
//     };

//     const extractIndexesFromProductName = (productName) => {
//         const matches = productName.match(/\b(\d{2,3})([A-Z]{1,2})\b/g) || [];
//         const rIdx = productName.search(/\bR\d+\b/i);
//         if (rIdx === -1) return { lastIndex: '', speedIndex: '' };
//         const tail = productName.substring(rIdx + 2);
//         const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//         if (idxMatch) return { lastIndex: idxMatch[1], speedIndex: idxMatch[2] };

//         if (matches.length > 0) {
//             const m = matches[0].match(/(\d{2,3})([A-Z]{1,2})/);
//             if (m) return { lastIndex: m[1], speedIndex: m[2] };
//         }
//         return { lastIndex: '', speedIndex: '' };
//     };

//     try {
//         const product = await Product.findOne({
//             $or: [
//                 { _id: productId },
//                 { ean: productId },
//                 { aw_product_id: productId }
//             ]
//         }).lean();

//         if (!product) {
//             return res.status(404).json({ message: "Product not found" });
//         }

//         // FORMAT MAIN PRODUCT PRICES
//         const formattedProduct = {
//             ...product,
//             search_price: formatPrice(product.search_price),
//             main_price: formatPrice(product.main_price),
//             cheapest_offer: formatPrice(product.cheapest_offer),
//             expensive_offer: formatPrice(product.expensive_offer),
//         };

//         // FORMAT OFFERS IN MAIN PRODUCT
//         if (Array.isArray(product.offers)) {
//             formattedProduct.offers = product.offers.map(offer => ({
//                 ...offer,
//                 price: formatPrice(offer.price),
//             }));
//         }

//         // Cache logic (if you use caching)
//         const cacheKey = `related:${product._id}`;
//         const cached = getCachedRelatedProducts?.(cacheKey);
//         if (cached) {
//             // Also format prices in cached related products
//             const formattedRelated = cached.map(p => ({
//                 ...p,
//                 search_price: formatPrice(p.search_price),
//                 cheapest_offer: formatPrice(p.cheapest_offer),
//                 expensive_offer: formatPrice(p.expensive_offer),
//                 offers: Array.isArray(p.offers)
//                     ? p.offers.map(o => ({ ...o, price: formatPrice(o.price) }))
//                     : []
//             }));
//             return res.status(200).json({ product: formattedProduct, relatedProducts: formattedRelated });
//         }

//         const { width, height, diameter } = parseTyreDimensions(product.dimensions || '');
//         const { lastIndex, speedIndex } = extractIndexesFromProductName(product.product_name || '');

//         const relatedFilter = {
//             merchant_product_third_category: product.merchant_product_third_category,
//             product_category: product.product_category,
//             _id: { $ne: product._id }
//         };

//         if (width) relatedFilter.dimensions = new RegExp(`^${width}[ /-]`);
//         if (height) relatedFilter.dimensions = new RegExp(`[ /-]${height}[ /-]`);
//         if (diameter) relatedFilter.dimensions = new RegExp(`R?${diameter}$`, 'i');
//         if (speedIndex) relatedFilter.product_name = new RegExp(`\\d{2,3}${speedIndex}`, 'i');
//         if (lastIndex) relatedFilter.product_name = new RegExp(`\\b${lastIndex}[A-Z]{1,2}\\b`, 'i');

//         // Fetch all matching
//         const allMatchingProducts = await Product.find(relatedFilter)
//             .select('product_name brand_name brand_logo dimensions search_price product_image merchant_product_third_category product_url in_stock createdAt fuel_class wet_grip noise_class speedIndex lastIndex average_rating review_count cheapest_offer expensive_offer savings_percent total_offers offers')
//             .sort({ createdAt: -1, search_price: 1 }) // sort by newest and lowest price
//             .lean();

//         // Group by brand
//         const brandMap = new Map();
//         for (const p of allMatchingProducts) {
//             if (!brandMap.has(p.brand_name)) {
//                 brandMap.set(p.brand_name, p);
//             }
//             if (brandMap.size >= 10) break;
//         }
//         // Format related products
//         const relatedProducts = Array.from(brandMap.values()).map(p => ({
//             ...p,
//             search_price: formatPrice(p.search_price),
//             cheapest_offer: formatPrice(p.cheapest_offer),
//             expensive_offer: formatPrice(p.expensive_offer),
//             offers: Array.isArray(p.offers)
//                 ? p.offers.map(o => ({ ...o, price: formatPrice(o.price) }))
//                 : []
//         }));

//         // Save to cache if needed
//         setCachedRelatedProducts?.(cacheKey, relatedProducts);

//         return res.status(200).json({ product: formattedProduct, relatedProducts });
//     } catch (err) {
//         console.error('Error fetching product details:', err);
//         return res.status(500).json({ message: 'Server error' });
//     }
// };

export const getProductDetails = async (req, res) => {
    const { productId } = req.params;

    // Helpers
    const parseTyreDimensions = (dim) => {
        if (!dim) return { width: '', height: '', diameter: '' };
        const match =
            dim.match(/^(\d+)[ /-](\d+)[ /-]R\s?(\d+)$/i) ||
            dim.match(/^(\d+)[ /-](\d+)[ /-](\d+)$/i) ||
            dim.match(/^(\d+)\/(\d+)R(\d+)$/i) ||
            dim.match(/^(\d+)\/(\d+)\/?R?(\d+)$/i);
        if (match) return { width: match[1], height: match[2], diameter: match[3] };

        const rMatch = dim.match(/R\s?(\d+)/i);
        const parts = dim.match(/\d+/g) || [];
        return {
            width: parts[0] || '',
            height: parts[1] || '',
            diameter: rMatch ? rMatch[1] : parts[2] || '',
        };
    };

    const extractIndexesFromProductName = (productName) => {
        const matches = productName.match(/\b(\d{2,3})([A-Z]{1,2})\b/g) || [];
        const rIdx = productName.search(/\bR\d+\b/i);
        if (rIdx === -1) return { lastIndex: '', speedIndex: '' };
        const tail = productName.substring(rIdx + 2);
        const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
        if (idxMatch) return { lastIndex: idxMatch[1], speedIndex: idxMatch[2] };

        if (matches.length > 0) {
            const m = matches[0].match(/(\d{2,3})([A-Z]{1,2})/);
            if (m) return { lastIndex: m[1], speedIndex: m[2] };
        }
        return { lastIndex: '', speedIndex: '' };
    };

    try {
        const product = await Product.findOne({
            $or: [
                { _id: productId },
                { ean: productId },
                { aw_product_id: productId }
            ]
        }).lean();

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Format price fields
        const formattedProduct = {
            ...product,
            search_price: formatPrice(product.search_price),
            main_price: formatPrice(product.main_price),
            cheapest_offer: formatPrice(product.cheapest_offer),
            expensive_offer: formatPrice(product.expensive_offer),
        };

        if (Array.isArray(product.offers)) {
            formattedProduct.offers = product.offers.map(o => ({
                ...o,
                price: formatPrice(o.price),
            }));
        }

        // Try cache first
        const cacheKey = `related:${product._id}`;
        const cached = getCachedRelatedProducts?.(cacheKey);
        if (cached) {
            const formattedRelated = cached.map(p => ({
                ...p,
                search_price: formatPrice(p.search_price),
                cheapest_offer: formatPrice(p.cheapest_offer),
                expensive_offer: formatPrice(p.expensive_offer),
                offers: Array.isArray(p.offers)
                    ? p.offers.map(o => ({ ...o, price: formatPrice(o.price) }))
                    : []
            }));
            return res.status(200).json({ product: formattedProduct, relatedProducts: formattedRelated });
        }

        // Parse related filter
        const { width, height, diameter } = parseTyreDimensions(product.dimensions || '');
        const { lastIndex, speedIndex } = extractIndexesFromProductName(product.product_name || '');

        const baseMatch = {
            merchant_product_third_category: product.merchant_product_third_category,
            product_category: product.product_category,
            _id: { $ne: product._id }
        };

        const conditions = [];

        if (width) conditions.push({ dimensions: new RegExp(`^${width}[ /-]`) });
        if (height) conditions.push({ dimensions: new RegExp(`[ /-]${height}[ /-]`) });
        if (diameter) conditions.push({ dimensions: new RegExp(`R?${diameter}$`, 'i') });
        if (speedIndex) conditions.push({ product_name: new RegExp(`\\d{2,3}${speedIndex}`, 'i') });
        if (lastIndex) conditions.push({ product_name: new RegExp(`\\b${lastIndex}[A-Z]{1,2}\\b`, 'i') });

        const finalMatch = { ...baseMatch };
        if (conditions.length) {
            finalMatch.$and = conditions;
        }

        // Aggregation for related products using disk if needed
        const related = await Product.aggregate([
            { $match: finalMatch },
            { $sort: { createdAt: -1, search_price: 1 } },
            { $limit: 5000 }, // Safety cap before grouping
            {
                $group: {
                    _id: "$brand_name",
                    doc: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$doc" } },
            { $limit: 10 }
        ], { allowDiskUse: true });

        const relatedProducts = related.map(p => ({
            ...p,
            search_price: formatPrice(p.search_price),
            cheapest_offer: formatPrice(p.cheapest_offer),
            expensive_offer: formatPrice(p.expensive_offer),
            offers: Array.isArray(p.offers)
                ? p.offers.map(o => ({ ...o, price: formatPrice(o.price) }))
                : []
        }));

        // Cache for future
        setCachedRelatedProducts?.(cacheKey, relatedProducts);

        return res.status(200).json({
            product: formattedProduct,
            relatedProducts
        });
    } catch (err) {
        console.error('Error fetching product details:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};


export const getBrandSummary = async (req, res) => {
    try {
        const brandSummary = await Product.aggregate([
            {
                $group: {
                    _id: "$brand_name",
                    brandLogo: { $first: "$brand_logo" },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    _id: 0,
                    brand_name: { $ifNull: ["$_id", "Unknown"] },
                    brandLogo: { $ifNull: ["$brandLogo", ""] },
                    count: 1
                }
            },
            {
                $sort: { count: -1 } // Optional: sort by product count descending
            }
        ]);

        res.status(200).json({
            message: "Brand summary with product counts",
            brands: brandSummary,
        });
    } catch (error) {
        console.error("Error fetching brand summary:", error);
        res.status(500).json({
            message: "Server error",
            error: error.message || String(error),
        });
    }
};

 
export const getLatestProducts = async (req, res) => {
    try {
        const result = await Product.aggregate([
            // Sort recent products by createdAt
            { $sort: { createdAt: -1 } },

            // Limit to 500 to keep memory usage reasonable
            { $limit: 500 },

            // Group by unique brand
            {
                $group: {
                    _id: "$brand_name",
                    product: { $first: "$$ROOT" }
                }
            },

            // Limit to 10 unique brand entries
            { $limit: 10 },

            // Project required fields
            {
                $replaceRoot: { newRoot: "$product" }
            },

            {
                $project: {
                    brand_name: 1,
                    brand_logo: 1,
                    product_image: 1,
                    product_name: 1,
                    in_stock: 1,
                    search_price: 1,
                    merchant_product_third_category: 1,
                    product_url: 1,
                    fuel_class: 1,
                    wet_grip: 1,
                    noise_class: 1,
                    dimensions: 1,
                    average_rating: 1,
                    review_count: 1,
                    cheapest_offer: 1,
                    expensive_offer: 1,
                    savings_percent: 1,
                    total_offers: 1,
                    offers: 1,
                    width: 1,
                    height: 1,
                    diameter: 1,
                    speedIndex: 1,
                    lastIndex: 1,
                    product_category: 1,
                    related_cheaper: 1,
                }
            }
        ]);

        if (!result.length) {
            return res.status(404).json({ message: "No products found." });
        }

        return res.status(200).json({
            message: "Latest 10 products (fast with facet & related_cheaper)",
            products: result
        });
    } catch (error) {
        console.error("Error fetching latest products:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message || String(error),
        });
    }
};


export const updateFeaturedSettings = async (req, res) => {
    try {
        const { category, section_title } = req.body;
        if (!category || !section_title) {
            return res.status(400).json({ message: 'Category and title are required' });
        }

        const updated = await FeaturedSettings.findOneAndUpdate(
            {},
            { category, section_title },
            { upsert: true, new: true }
        );

        res.status(200).json({ message: 'Settings updated', settings: updated });
    } catch (err) {
        res.status(500).json({ message: 'Failed to update settings', error: err.message });
    }
};

export const getFeaturedProducts = async (req, res) => {
    try {
        const settings = await FeaturedSettings.findOne();
        const category = settings?.category || "Winterreifen";
        const maxBrands = settings?.max_brands || 10;
        const competitorsPerProduct = settings?.competitors_per_product || 3;

        const result = await Product.aggregate([
            // Match category (case-insensitive exact match)
            {
                $match: {
                    merchant_product_third_category: {
                        $regex: new RegExp(`^${category}$`, "i")
                    }
                }
            },

            // Sort by rating, then createdAt
            { $sort: { average_rating: -1, createdAt: -1 } },

            // Limit to reduce memory usage
            { $limit: 1000 },

            // Group by brand to pick the top-rated per brand
            {
                $group: {
                    _id: "$brand_name",
                    product: { $first: "$$ROOT" }
                }
            },

            // Limit to N brands
            { $limit: maxBrands },

            // Flatten product object
            { $replaceRoot: { newRoot: "$product" } },

            // Pick only necessary fields for speed
            {
                $project: {
                    brand_logo: 1,
                    fuel_class: 1,
                    product_image: 1,
                    wet_grip: 1,
                    noise_class: 1,
                    dimensions: 1,
                    merchant_product_third_category: 1,
                    product_url: 1,
                    product_name: 1,
                    brand_name: 1,
                    search_price: 1,
                    merchant_product_category_path: 1,
                    merchant_product_second_category: 1,
                    average_rating: 1,
                    review_count: 1,
                    cheapest_offer: 1,
                    expensive_offer: 1,
                    savings_percent: 1,
                    total_offers: 1,
                    offers: 1,
                    in_stock: 1,
                    width: 1,
                    height: 1,
                    diameter: 1,
                    speedIndex: 1,
                    lastIndex: 1,
                    product_category: 1,
                    related_cheaper: { $slice: ["$related_cheaper", competitorsPerProduct] }
                }
            }
        ]);

        if (!result.length) {
            return res.status(404).json({ message: "No featured products found." });
        }

        // Format prices for frontend
        const formatted = result.map((p) => ({
            ...p,
            cheapest_offer: typeof p.cheapest_offer === "number"
                ? p.cheapest_offer.toFixed(2).replace(".", ",")
                : "0,00",
            expensive_offer: typeof p.expensive_offer === "number"
                ? p.expensive_offer.toFixed(2).replace(".", ",")
                : "0,00",
            search_price: typeof p.search_price === "number"
                ? p.search_price.toFixed(2).replace(".", ",")
                : "0,00",
        }));

        return res.status(200).json({
            title: settings?.section_title || "Our recommendation",
            category,
            products: formatted
        });

    } catch (err) {
        console.error("⚠️ Featured product fetch error:", err);
        res.status(500).json({
            message: "Server error",
            error: err.message || String(err),
        });
    }
};


// const fieldMap = {
//   category: 'merchant_product_third_category',
//   width: 'width',
//   height: 'height',
//   diameter: 'diameter',
//   brand: 'brand_name',
//   wetGrip: 'wet_grip',
//   fuelClass: 'fuel_class',
//   noise: 'noise_class',
// };

// export const GetFilterTyres = async (req, res) => {
//   try {
//     const baseQuery = {};

//     for (const [key, value] of Object.entries(req.query)) {
//       if (value && fieldMap[key]) {
//         baseQuery[fieldMap[key]] = value;
//       }
//     }

//     const buildFieldData = async (key) => {
//       const field = fieldMap[key];
//       const query = { ...baseQuery };
//       delete query[field]; // Remove current field for faceting

//       const values = await Product.distinct(field, query);
//       const counts = await Promise.all(
//         values.map(async (val) => {
//           const count = await Product.countDocuments({ ...query, [field]: val });
//           return { name: val, count };
//         })
//       );

//       return counts.sort((a, b) => b.count - a.count);
//     };

//     const [
//       categories,
//       widths,
//       heights,
//       diameters,
//       brands,
//       wetGrips,
//       fuelClasses,
//       noises,
//     ] = await Promise.all([
//       buildFieldData('category'),
//       buildFieldData('width'),
//       buildFieldData('height'),
//       buildFieldData('diameter'),
//       buildFieldData('brand'),
//       buildFieldData('wetGrip'),
//       buildFieldData('fuelClass'),
//       buildFieldData('noise'),
//     ]);

//     return res.status(200).json({
//       categories,
//       widths,
//       heights,
//       diameters,
//       brands,
//       wetGrips,
//       fuelClasses,
//       noises,
//     });
//   } catch (err) {
//     console.error('Error in GetFilterTyres:', err);
//     return res.status(500).json({ message: 'Server error', error: err.message });
//   }
// };
export const GetFilterTyres = async (req, res) => {
    try {
        const {
            category,
            width,
            height,
            diameter,
            brand,
            wetGrip,
            fuelClass,
            noise,
        } = req.query;

        const baseQuery = {};
        if (category) baseQuery.merchant_product_third_category = category;
        if (width) baseQuery.width = width;
        if (height) baseQuery.height = height;
        if (diameter) baseQuery.diameter = diameter;
        if (brand) baseQuery.brand = brand;
        if (wetGrip) baseQuery.wetGrip = wetGrip;
        if (fuelClass) baseQuery.fuelClass = fuelClass;
        if (noise) baseQuery.noise = noise;

        const buildFacetPipeline = (fieldToGroup, removeFieldFromQuery) => {
            const matchStage = { ...baseQuery };
            delete matchStage[removeFieldFromQuery];

            return [
                { $match: matchStage },
                {
                    $group: {
                        _id: `$${fieldToGroup}`,
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        name: '$_id',
                        count: 1,
                        _id: 0,
                    },
                },
                {
                    $sort: { count: -1 },
                },
            ];
        };

        const result = await Product.aggregate([
            {
                $facet: {
                    categories: buildFacetPipeline('merchant_product_third_category', 'merchant_product_third_category'),
                    widths: buildFacetPipeline('width', 'width'),
                    heights: buildFacetPipeline('height', 'height'),
                    diameters: buildFacetPipeline('diameter', 'diameter'),
                    brands: buildFacetPipeline('brand_name', 'brand_name'),
                    wetGrips: buildFacetPipeline('wet_grip', 'wet_grip'),
                    fuelClasses: buildFacetPipeline('fuel_class', 'fuel_class'),
                    noises: buildFacetPipeline('noise_class', 'noise_class'),
                },
            },
        ]);

        const {
            categories,
            widths,
            heights,
            diameters,
            brands,
            wetGrips,
            fuelClasses,
            noises,
        } = result[0];

        return res.status(200).json({
            categories,
            widths,
            heights,
            diameters,
            brands,
            wetGrips,
            fuelClasses,
            noises,
        });
    } catch (err) {
        console.error('Error in GetFilterTyres:', err);
        return res.status(500).json({ message: 'Server error', error: err.message });
    }
};


export const getSearchSuggestions = async (req, res) => {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Invalid query parameter' });
    }

    try {
        const searchRegex = { $regex: query, $options: 'i' };

        const products = await Product.find({
            $or: [
                { product_name: searchRegex },
                { merchant_product_third_category: searchRegex },
                { brand_name: searchRegex },
            ],
        })
            .limit(20)
            .select('product_name merchant_product_third_category brand_name');

        const suggestions = [];
        const added = new Set();

        products.forEach(product => {
            if (
                product.product_name &&
                !added.has(`product:${product.product_name}`)
            ) {
                suggestions.push({
                    id: product._id,
                    name: product.product_name,
                    type: 'Product',
                });
                added.add(`product:${product.product_name}`);
            }

            if (
                product.merchant_product_third_category &&
                !added.has(`category:${product.merchant_product_third_category}`)
            ) {
                suggestions.push({
                    id: product.merchant_product_third_category,
                    name: product.merchant_product_third_category,
                    type: 'Category',
                });
                added.add(`category:${product.merchant_product_third_category}`);
            }

            if (product.brand_name && !added.has(`brand:${product.brand_name}`)) {
                suggestions.push({
                    id: product.brand_name,
                    name: product.brand_name,
                    type: 'Brand',
                });
                added.add(`brand:${product.brand_name}`);
            }
        });

        res.status(200).json(suggestions);
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
  

// POST /api/products/upload-csv
export const uploadCsv = async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    try {
        console.log("[UPLOAD] File received at:", req.file.path);
        startCsvImportAsync(req.file.path);
        res.json({ success: true, message: "CSV accepted and importing in background" });
    } catch (err) {
        res.status(500).json({ error: err.message || "Import failed" });
    }
};