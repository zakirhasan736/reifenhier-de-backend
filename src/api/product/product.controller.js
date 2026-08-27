import FeaturedSettings from '../../models/FeaturedSettings.js';
import Product from '../../models/product.js';
import { startCsvImportAsync } from "./importAWINCsv.js";



export const productLists = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            sort,
            order,
            sortField,
            sortOrder,
            minPrice,
            maxPrice,
        } = req.query;

        const toArray = (val) =>
            Array.isArray(val)
                ? val
                : val
                    ? typeof val === 'string'
                        ? val.split(',').filter(Boolean)
                        : [val]
                    : [];

        // -------- Price range (numbers, optional) --------
        const lo =
            minPrice !== undefined && minPrice !== ''
                ? Number(minPrice)
                : undefined;
        const hi =
            maxPrice !== undefined && maxPrice !== ''
                ? Number(maxPrice)
                : undefined;

        // Build base filters
        const filters = {
            ...(req.query.kategorie && {
                merchant_product_third_category: { $in: toArray(req.query.kategorie) },
            }),

            ...(req.query.brand && {
                brand_name: { $in: toArray(req.query.brand) },
            }),
            ...(req.query.width && { width: { $in: toArray(req.query.width) } }),
            ...(req.query.height && { height: { $in: toArray(req.query.height) } }),
            ...(req.query.diameter && { diameter: { $in: toArray(req.query.diameter) } }),
            ...(req.query.speedIndex && { speedIndex: { $in: toArray(req.query.speedIndex) } }),
            ...(req.query.lastIndex && { lastIndex: { $in: toArray(req.query.lastIndex) } }),
            ...(req.query.noise && { noise_class: { $in: toArray(req.query.noise) } }),
            ...(req.query.fuelClass && { fuel_class: { $in: toArray(req.query.fuelClass) } }),
            ...(req.query.wetGrip && { wet_grip: { $in: toArray(req.query.wetGrip) } }),
        };

        // ---- Apply price range to either search_price or main_price ----
        if (lo !== undefined || hi !== undefined) {
            const range = {};
            if (lo !== undefined) range.$gte = lo;
            if (hi !== undefined) range.$lte = hi;

            // If both prices exist in DB, check either one is within range
            filters.$or = [
                { search_price: range },
                { main_price: range },
            ];
        }

        // -------- Sort mapping --------
        const sortFieldFinal = (sortField || sort || 'createdAt').toString();
        const sortOrderFinal = (sortOrder || order || 'desc').toString();
        // if frontend asks for "price", map to search_price (or main_price fallback)
        // (For perfect fallback sorting, switch to an aggregate with $ifNull)
        const fieldMap = {
            price: 'search_price',
        };
        const mongoSortField = fieldMap[sortFieldFinal] || sortFieldFinal;
        const sortOption = { [mongoSortField]: sortOrderFinal === 'asc' ? 1 : -1 };

        const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        // -------- Facets (ignore the current facet filter itself) --------
        const fieldMapFacets = {
            categories: 'merchant_product_third_category',
            brands: 'brand_name',
            widths: 'width',
            heights: 'height',
            diameters: 'diameter',
            speedIndexes: 'speedIndex',
            lastIndexes: 'lastIndex',
            noises: 'noise_class',
            fuelClasses: 'fuel_class',
            wetGrips: 'wet_grip',
        };

        const facetStage = {};
        for (const [facetName, field] of Object.entries(fieldMapFacets)) {
            const filterCopy = { ...filters };
            // Remove only the exact field (not price filters)
            if (filterCopy[field]) delete filterCopy[field];
            facetStage[facetName] = [
                { $match: filterCopy },
                { $project: { [field]: 1 } },
                { $group: { _id: `$${field}`, count: { $sum: 1 } } },
                { $project: { name: '$_id', count: 1, _id: 0 } },
            ];
        }

        // Price min/max from current filtered result set
        facetStage.prices = [
            { $match: filters },
            {
                $group: {
                    _id: null,
                    // use search_price if present, otherwise main_price
                    min: { $min: { $ifNull: ['$search_price', '$main_price'] } },
                    max: { $max: { $ifNull: ['$search_price', '$main_price'] } },
                },
            },
        ];

        // -------- Main query ----------
        // NOTE: Keep price fields numeric in response; format on the frontend
        const [productsRaw, total, agg] = await Promise.all([
            Product.find(filters)
                .sort(sortOption)
                .skip(skip)
                .limit(parseInt(limit, 10))
                .select({
                    brand_logo: 1,
                    fuel_class: 1,
                    related_cheaper: 1,
                    slug: 1,
                    in_stock: 1,
                    product_image: 1,
                    awin_image_url: 1,
                    merchant_thumb_url: 1,
                    wet_grip: 1,
                    noise_class: 1,
                    dimensions: 1,
                    merchant_product_third_category: 1,
                    product_url: 1,
                    product_name: 1,
                    brand_name: 1,
                    search_price: 1,
                    main_price: 1,
                    merchant_product_category_path: 1,
                    merchant_product_second_category: 1,
                    cheapest_offer: 1,
                    expensive_offer: 1,
                    speedIndex: 1,
                    lastIndex: 1,
                    width: 1,
                    height: 1,
                    diameter: 1,
                    ean: 1,
                    savings_percent: 1,
                    total_offers: 1,
                    average_rating: 1,
                    review_count: 1,
                    merchant_image_url: 1,
                    tyre_label_info: 1,
                    cheapest_vendor: 1,
                    offers: 1,
                })
                .lean(),
            Product.countDocuments(filters),
            Product.aggregate([{ $facet: facetStage }], { allowDiskUse: true }),
        ]);
                // Keep money fields numeric for clients/SEO (format in the UI).
                const products = await Promise.all(productsRaw.map(async (product) => {
                    const stats = liveOfferStats(product.offers);
                    return {
                    ...product,
                    cheapest_offer: stats.cheapest || toNumericPrice(product.cheapest_offer),
                    expensive_offer: stats.expensive || toNumericPrice(product.expensive_offer),
                    search_price: stats.cheapest || toNumericPrice(product.search_price),
                    main_price: toNumericPrice(product.main_price),
                    offers: stats.sorted.slice(0, 3),
                    savings_percent: stats.savings_percent || product.savings_percent || "0%",
                    total_offers: product.total_offers || stats.sorted.length || 1,
                    cheapest_vendor: stats.cheapestOffer
                        ? { ...(product.cheapest_vendor || {}), ...stats.cheapestOffer, price: stats.cheapest }
                        : product.cheapest_vendor,
                    zum_angebot_url: stats.cheapestOffer?.aw_deep_link || "",
                    vendor_name: stats.cheapestOffer?.vendor || "",
                    vendor_logo: stats.cheapestOffer?.vendor_logo || "",
                    };
                }));

        const result = agg[0] || {};
        const priceData = result.prices?.[0] || { min: 0, max: 0 };

        // IMPORTANT: return numbers, do NOT stringify them here
        // If you must format, do it in React UI.
        return res.status(200).json({
            total,
            products,
            minPrices: Number(priceData.min) || 0,
            maxPrices: Number(priceData.max) || 0,
            filterGroups: {
                kategories: result.categories || [],
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
        console.error('Error in productLists:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Lightweight sitemap feed — slug + updatedAt only (no facets/offers).
 * Supports 50k+ catalogs via page/limit chunks.
 */
export const productSitemapSlugs = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limit = Math.min(
            50000,
            Math.max(1, parseInt(String(req.query.limit || '10000'), 10) || 10000)
        );
        const skip = (page - 1) * limit;

        const filter = { slug: { $exists: true, $nin: [null, ''] } };

        const [total, products] = await Promise.all([
            Product.countDocuments(filter),
            Product.find(filter)
                .sort({ _id: 1 })
                .skip(skip)
                .limit(limit)
                .select('slug updatedAt')
                .lean(),
        ]);

        return res.status(200).json({
            total,
            page,
            limit,
            pages: Math.max(1, Math.ceil(total / limit)),
            products: products.map((p) => ({
                slug: p.slug,
                updatedAt: p.updatedAt || null,
            })),
        });
    } catch (err) {
        console.error('Error in productSitemapSlugs:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ========================================
const relatedProductsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 300;

function pruneRelatedCache() {
    const now = Date.now();
    for (const [key, entry] of relatedProductsCache) {
        if (now - entry.timestamp > CACHE_TTL_MS) relatedProductsCache.delete(key);
    }
    while (relatedProductsCache.size > CACHE_MAX) {
        const oldest = relatedProductsCache.keys().next().value;
        relatedProductsCache.delete(oldest);
    }
}

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
    relatedProductsCache.delete(key);
    relatedProductsCache.set(key, { data, timestamp: Date.now() });
    pruneRelatedCache();
};
// --- UTIL: Price formatting ---
function formatPrice(value) {
    if (typeof value === "number") return value.toFixed(2).replace(".", ",");
    if (!value || value === "-") return "0,00";
    const n = parseFloat(value);
    if (!isNaN(n)) return n.toFixed(2).replace(".", ",");
    return "0,00";
}

function toNumericPrice(value) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
    if (value == null || value === "" || value === "-") return 0;
    const normalized = String(value)
        .trim()
        .replace(/\s/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", ".")
        .replace(/[^\d.]/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function sortOffersByPrice(offers = []) {
    return [...offers].sort((a, b) => toNumericPrice(a?.price) - toNumericPrice(b?.price));
}

function liveOfferStats(offers = []) {
    const sorted = sortOffersByPrice(offers).map((o) => ({
        ...o,
        price: toNumericPrice(o.price),
    })).filter((o) => o.price > 0);
    const prices = sorted.map((o) => o.price);
    const cheapest = prices.length ? Math.min(...prices) : 0;
    const expensive = prices.length ? Math.max(...prices) : 0;
    const cheapestOffer = sorted.find((o) => o.price === cheapest) || null;
    const savings_percent =
        expensive > cheapest && expensive > 0
            ? `-${Math.round(((expensive - cheapest) / expensive) * 100)}%`
            : "0%";
    return { sorted, cheapest, expensive, cheapestOffer, savings_percent };
}  
  
export const getProductDetails = async (req, res) => {
    const { slug } = req.params;

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
        const product = await Product.findOne({ slug }).lean();
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        const offerStats = liveOfferStats(product.offers);
        const formattedProduct = {
            ...product,
            search_price: offerStats.cheapest || toNumericPrice(product.search_price),
            main_price: toNumericPrice(product.main_price),
            cheapest_offer: offerStats.cheapest || toNumericPrice(product.cheapest_offer),
            expensive_offer: offerStats.expensive || toNumericPrice(product.expensive_offer),
            savings_percent: offerStats.savings_percent || product.savings_percent || "0%",
            offers: offerStats.sorted,
            cheapest_vendor: offerStats.cheapestOffer
                ? { ...(product.cheapest_vendor || {}), ...offerStats.cheapestOffer, price: offerStats.cheapest }
                : product.cheapest_vendor,
        };

        const { width, height, diameter } = parseTyreDimensions(product.dimensions || '');
        const { lastIndex, speedIndex } = extractIndexesFromProductName(product.product_name || '');

        // Same size + brand, other load/speed indexes (e.g. 99V vs 91H)
        const productWidth = String(product.width || width || '');
        const productHeight = String(product.height || height || '');
        const productDiameter = String(product.diameter || diameter || '');
        const currentIndexKey = `${product.lastIndex || lastIndex || ''}${product.speedIndex || speedIndex || ''}`;
        let indexVariants = [];

        if (product.brand_name && productWidth && productHeight && productDiameter) {
            const variants = await Product.find(
                {
                    _id: { $ne: product._id },
                    brand_name: product.brand_name,
                    width: productWidth,
                    height: productHeight,
                    diameter: productDiameter,
                },
                {
                    slug: 1,
                    lastIndex: 1,
                    speedIndex: 1,
                    cheapest_offer: 1,
                    search_price: 1,
                    product_name: 1,
                }
            )
                .sort({ cheapest_offer: 1 })
                .limit(24)
                .lean();

            const seen = new Map();
            for (const v of variants) {
                const key = `${v.lastIndex || ''}${v.speedIndex || ''}`;
                if (!key.trim() || key === currentIndexKey) continue;
                const price = Number(v.cheapest_offer || v.search_price || 0);
                const prev = seen.get(key);
                if (!prev || (price > 0 && price < prev.price)) {
                    seen.set(key, {
                        slug: v.slug,
                        lastIndex: v.lastIndex || '',
                        speedIndex: v.speedIndex || '',
                        price,
                        label: key,
                        product_name: v.product_name,
                        cheapest_offer: formatPrice(price),
                    });
                }
            }
            indexVariants = Array.from(seen.values())
                .sort((a, b) => a.price - b.price)
                .slice(0, 10);
        }

        // Try cache first
        const cacheKey = `related:${product._id}`;
        const cached = getCachedRelatedProducts?.(cacheKey);
        if (cached) {
            const formattedRelated = cached.map(p => {
                const stats = liveOfferStats(p.offers);
                return {
                ...p,
                search_price: stats.cheapest || toNumericPrice(p.search_price),
                cheapest_offer: stats.cheapest || toNumericPrice(p.cheapest_offer),
                expensive_offer: stats.expensive || toNumericPrice(p.expensive_offer),
                savings_percent: stats.savings_percent || p.savings_percent || "0%",
                offers: stats.sorted.slice(0, 3),
                };
            });
            return res.status(200).json({
                product: formattedProduct,
                relatedProducts: formattedRelated,
                indexVariants,
            });
        }

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

        const related = await Product.aggregate([
            { $match: finalMatch },
            {
                $project: {
                    brand_name: 1,
                    slug: 1,
                    product_image: 1,
                    awin_image_url: 1,
                    merchant_thumb_url: 1,
                    merchant_image_url: 1,
                    brand_logo: 1,
                    product_name: 1,
                    search_price: 1,
                    cheapest_offer: 1,
                    expensive_offer: 1,
                    savings_percent: 1,
                    merchant_product_third_category: 1,
                    in_stock: 1,
                    dimensions: 1,
                    fuel_class: 1,
                    wet_grip: 1,
                    noise_class: 1,
                    createdAt: 1,
                    tyre_label_info: 1,
                    offers: 1,
                },
            },
            { $sort: { createdAt: -1, search_price: 1 } },
            { $limit: 80 },
            {
                $group: {
                    _id: "$brand_name",
                    doc: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$doc" } },
            { $limit: 10 }
        ], { allowDiskUse: true });

        const relatedProducts = related.map(p => {
            const stats = liveOfferStats(p.offers);
            return {
            ...p,
            search_price: stats.cheapest || toNumericPrice(p.search_price),
            cheapest_offer: stats.cheapest || toNumericPrice(p.cheapest_offer),
            expensive_offer: stats.expensive || toNumericPrice(p.expensive_offer),
            savings_percent: stats.savings_percent || p.savings_percent || "0%",
            offers: stats.sorted.slice(0, 3),
            };
        });

        // Cache for future
        setCachedRelatedProducts?.(cacheKey, relatedProducts);

        return res.status(200).json({
            product: formattedProduct,
            relatedProducts,
            indexVariants,
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
                    slug: 1,
                    brand_logo: 1,
                    product_image: 1,
                    awin_image_url: 1,
                    merchant_thumb_url: 1,
                    merchant_image_url: 1,
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
                    tyre_label_info: 1,
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
        // Keep money fields numeric — format in the UI.
        const formatted = result.map((p) => {
            const stats = liveOfferStats(p.offers);
            return {
            ...p,
            cheapest_offer: stats.cheapest || toNumericPrice(p.cheapest_offer),
            expensive_offer: stats.expensive || toNumericPrice(p.expensive_offer),
            search_price: stats.cheapest || toNumericPrice(p.search_price),
            savings_percent: stats.savings_percent || p.savings_percent || "0%",
            offers: stats.sorted.slice(0, 3),
            };
        });

        return res.status(200).json({
            message: "Latest 10 products (fast with facet & related_cheaper)",
            products: formatted
        });
    } catch (error) {
        console.error("Error fetching latest products:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message || String(error),
        });
    }
};


// export const updateFeaturedSettings = async (req, res) => {
//     try {
//         const { category, section_title, mode, selected_products } = req.body;

//         if (!category || !section_title) {
//             return res
//                 .status(400)
//                 .json({ message: "Category and title are required" });
//         }

//         if (!["default", "custom"].includes(mode)) {
//             return res.status(400).json({ message: "Invalid mode" });
//         }

//         if (mode === "custom" && selected_products?.length > 10) {
//             return res.status(400).json({
//                 message: "You can select maximum 10 products",
//             });
//         }

//         const updateData = {
//             category,
//             section_title,
//             mode,
//             selected_products: mode === "custom" ? selected_products : [],
//         };

//         const updated = await FeaturedSettings.findOneAndUpdate(
//             {},
//             updateData,
//             { upsert: true, new: true }
//         );

//         return res
//             .status(200)
//             .json({ message: "Settings updated", settings: updated });
//     } catch (err) {
//         return res.status(500).json({
//             message: "Failed to update settings",
//             error: err.message,
//         });
//     }
// };


// export const getFeaturedProducts = async (req, res) => {
//     try {
//         const settings = await FeaturedSettings.findOne();

//         const {
//             category = "Winterreifen",
//             max_brands = 10,
//             competitors_per_product = 3,
//             mode = "default",
//             selected_products = [],
//         } = settings || {};

//         // ⭐ CUSTOM MODE → Return ONLY selected products
//         if (mode === "custom" && selected_products.length > 0) {
//             const products = await Product.find({
//                 _id: { $in: selected_products }
//             })
//                 .select(
//                     "brand_logo slug product_image fuel_class wet_grip noise_class dimensions product_name brand_name search_price cheapest_offer expensive_offer offers"
//                 )
//                 .lean();

//             return res.status(200).json({
//                 title: settings?.section_title || "Our recommendation",
//                 category,
//                 products,
//                 mode,
//             });
//         }

//         // ⭐ DEFAULT MODE (AUTO TOP FILTER)
//         const result = await Product.aggregate([
//             {
//                 $match: {
//                     merchant_product_third_category: {
//                         $regex: new RegExp(`^${category}$`, "i"),
//                     },
//                 },
//             },
//             { $sort: { average_rating: -1, createdAt: -1 } },
//             { $limit: 1000 },
//             {
//                 $group: {
//                     _id: "$brand_name",
//                     product: { $first: "$$ROOT" },
//                 },
//             },
//             { $limit: max_brands },
//             { $replaceRoot: { newRoot: "$product" } },
//             {
//                 $project: {
//                     brand_logo: 1,
//                     slug: 1,
//                     fuel_class: 1,
//                     product_image: 1,
//                     awin_image_url: 1,
//                     merchant_thumb_url: 1,
//                     wet_grip: 1,
//                     noise_class: 1,
//                     dimensions: 1,
//                     product_name: 1,
//                     brand_name: 1,
//                     search_price: 1,
//                     cheapest_offer: 1,
//                     expensive_offer: 1,
//                     offers: 1,
//                 },
//             },
//         ]);

//         return res.status(200).json({
//             title: settings?.section_title || "Our recommendation",
//             category,
//             products: result,
//             mode,
//         });
//     } catch (err) {
//         console.error("⚠️ Featured product fetch error:", err);
//         return res.status(500).json({
//             message: "Server error",
//             error: err.message,
//         });
//     }
// };


// // GET ALL PRODUCTS FOR SELECTED SESSION + SEARCH
// export const getProductsBySession = async (req, res) => {
//     try {
//         const { category, search = "" } = req.query;

//         if (!category) {
//             return res.status(400).json({ message: "Category is required" });
//         }

//         const filter = {
//             merchant_product_third_category: {
//                 $regex: new RegExp(`^${category}$`, "i"),
//             },
//         };

//         if (search) {
//             filter.product_name = { $regex: search, $options: "i" };
//         }

//         const products = await Product.find(filter)
//             .select(
//                 "product_name product_image search_price offers in_stock createdAt merchant_product_third_category"
//             )
//             .sort({ createdAt: -1 })
//             .limit(500)
//             .lean();

//         return res.status(200).json(products);
//     } catch (err) {
//         return res.status(500).json({
//             message: "Failed to load products",
//             error: err.message,
//         });
//     }
// };

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
                    slug: 1,
                    fuel_class: 1,
                    product_image: 1,
                    awin_image_url: 1,
                    merchant_thumb_url: 1,
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
                    tyre_label_info: 1,
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

        // Keep money fields numeric — format in the UI.
        const formatted = result.map((p) => {
            const stats = liveOfferStats(p.offers);
            return {
            ...p,
            cheapest_offer: stats.cheapest || toNumericPrice(p.cheapest_offer),
            expensive_offer: stats.expensive || toNumericPrice(p.expensive_offer),
            search_price: stats.cheapest || toNumericPrice(p.search_price),
            savings_percent: stats.savings_percent || p.savings_percent || "0%",
            offers: stats.sorted.slice(0, 3),
            };
        });

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
// export const GetFilterTyres = async (req, res) => {
//     try {
//         const {
//             kategorie, // frontend sends ?kategorie=Winter
//             width,
//             height,
//             diameter,
//             lastIndex,
//             wetGrip,
//             fuelClass,
//             noise,
//             brand,
//         } = req.query;

//         const baseQuery = {};

//         if (kategorie) {
//             baseQuery.merchant_product_third_category = Array.isArray(kategorie)
//                 ? { $in: kategorie }
//                 : kategorie;
//         }

//         if (brand) baseQuery.brand = brand;
//         if (width) baseQuery.width = width;
//         if (height) baseQuery.height = height;
//         if (diameter) baseQuery.diameter = diameter;
//         if (lastIndex) baseQuery.lastIndex = lastIndex;
//         if (wetGrip) baseQuery.wet_grip = wetGrip;
//         if (fuelClass) baseQuery.fuel_class = fuelClass;
//         if (noise) baseQuery.noise_class = noise;

//         const buildFacetPipeline = (fieldToGroup) => [
//             { $match: baseQuery },
//             { $match: { [fieldToGroup]: { $exists: true, $ne: null, $ne: '' } } },
//             {
//                 $group: { _id: `$${fieldToGroup}`, count: { $sum: 1 } },
//             },
//             { $project: { name: '$_id', count: 1, _id: 0 } },
//             { $sort: { count: -1, name: 1 } },
//         ];

//         const result = await Product.aggregate([
//             {
//                 $facet: {
//                     kategories: buildFacetPipeline('merchant_product_third_category'),
//                     brands: buildFacetPipeline('brand'),
//                     widths: buildFacetPipeline('width'),
//                     heights: buildFacetPipeline('height'),
//                     diameters: buildFacetPipeline('diameter'),
//                     lastIndexes: buildFacetPipeline('lastIndex'),
//                     wetGrips: buildFacetPipeline('wet_grip'),
//                     fuelClasses: buildFacetPipeline('fuel_class'),
//                     noises: buildFacetPipeline('noise_class'),
//                 },
//             },
//         ]);

//         const data = result[0] || {};
//         const response = {
//             kategories: data.kategories || [],
//             brands: data.brands || [],
//             widths: data.widths || [],
//             heights: data.heights || [],
//             diameters: data.diameters || [],
//             lastIndexes: data.lastIndexes || [],
//             wetGrips: data.wetGrips || [],
//             fuelClasses: data.fuelClasses || [],
//             noises: data.noises || [],
//         };

//         return res.status(200).json(response);
//     } catch (err) {
//         console.error('Error in GetFilterTyres:', err);
//         res.status(500).json({ message: 'Server error', error: err.message });
//     }
// };

export const GetFilterTyres = async (req, res) => {
    try {
        const {
            kategorie,
            width,
            height,
            diameter,
            lastIndex,
            wetGrip,
            fuelClass,
            noise,
            brand,
        } = req.query;

        // 1️⃣ CATEGORY-ONLY filter for dropdown lists
        const categoryOnlyQuery = {};
        if (kategorie) {
            categoryOnlyQuery.merchant_product_third_category = Array.isArray(kategorie)
                ? { $in: kategorie }
                : kategorie;
        }

        // 2️⃣ FULL filter for product results only
        const baseQuery = { ...categoryOnlyQuery };
        if (brand) baseQuery.brand = brand;
        if (width) baseQuery.width = width;
        if (height) baseQuery.height = height;
        if (diameter) baseQuery.diameter = diameter;
        if (lastIndex) baseQuery.lastIndex = lastIndex;
        if (wetGrip) baseQuery.wet_grip = wetGrip;
        if (fuelClass) baseQuery.fuel_class = fuelClass;
        if (noise) baseQuery.noise_class = noise;

        // 🔥 DROPDOWN LISTS: must ONLY filter by category
        const facetPipeline = (field) => [
            { $match: categoryOnlyQuery }, // 👈 ONLY category affects dropdowns
            { $match: { [field]: { $exists: true, $ne: "" } } },
            { $group: { _id: `$${field}`, count: { $sum: 1 } } },
            { $project: { name: "$_id", count: 1, _id: 0 } },
            { $sort: { name: 1 } }
        ];

        const result = await Product.aggregate([
            {
                $facet: {
                    kategories: [
                        { $match: { merchant_product_third_category: { $exists: true, $ne: "" } } },
                        { $group: { _id: "$merchant_product_third_category", count: { $sum: 1 } } },
                        { $project: { name: "$_id", count: 1, _id: 0 } },
                        { $sort: { name: 1 } }
                    ],
                    brands: facetPipeline("brand"),
                    widths: facetPipeline("width"),
                    heights: facetPipeline("height"),
                    diameters: facetPipeline("diameter"),
                    lastIndexes: facetPipeline("lastIndex"),
                    wetGrips: facetPipeline("wet_grip"),
                    fuelClasses: facetPipeline("fuel_class"),
                    noises: facetPipeline("noise_class"),
                }
            }
        ]);

        const data = result[0] || {};

        return res.json({
            kategories: data.kategories || [],
            brands: data.brands || [],
            widths: data.widths || [],
            heights: data.heights || [],
            diameters: data.diameters || [],
            lastIndexes: data.lastIndexes || [],
            wetGrips: data.wetGrips || [],
            fuelClasses: data.fuelClasses || [],
            noises: data.noises || [],
        });

    } catch (err) {
        console.error("Error in GetFilterTyres:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
};



// controller
// search suggestion for brand, categrory, product
// export const getSearchSuggestions = async (req, res) => {
//     const { query } = req.query;

//     if (!query || typeof query !== 'string') {
//         return res.status(400).json({ message: 'Invalid query parameter' });
//     }

//     try {
//         const searchRegex = { $regex: query, $options: 'i' };

//         const products = await Product.find({
//             $or: [
//                 { product_name: searchRegex },
//                 { merchant_product_third_category: searchRegex },
//                 { brand_name: searchRegex },
//             ],
//         })
//             .limit(20)
//             // ✅ include slug so the UI can route by slug
//             .select('slug product_name merchant_product_third_category brand_name product_image')
//             .lean();

//         const suggestions = [];
//         const added = new Set();

//         products.forEach((p) => {
//             // Product suggestions (dedupe by slug)
//             if (p.slug && p.product_name && !added.has(`produkt:${p.slug}`)) {
//                 suggestions.push({
//                     slug: p.slug,
//                     name: p.product_name,
//                     type: 'Produkt',
//                     image: p.product_image || null,
//                 });
//                 added.add(`produkt:${p.slug}`);
//             }

//             // Category suggestions (dedupe by category name)
//             if (
//                 p.merchant_product_third_category &&
//                 !added.has(`kategorie:${p.merchant_product_third_category}`)
//             ) {
//                 suggestions.push({
//                     id: p.merchant_product_third_category,
//                     name: p.merchant_product_third_category,
//                     type: 'Kategorie',
//                 });
//                 added.add(`kategorie:${p.merchant_product_third_category}`);
//             }

//             // Brand suggestions (dedupe by brand name)
//             if (p.brand_name && !added.has(`marke:${p.brand_name}`)) {
//                 suggestions.push({
//                     id: p.brand_name,
//                     name: p.brand_name,
//                     type: 'Marke',
//                 });
//                 added.add(`marke:${p.brand_name}`);
//             }
//         });

//         res.status(200).json(suggestions);
//     } catch (error) {
//         console.error('Error fetching search suggestions:', error);
//         res
//             .status(500)
//             .json({ message: 'Server error', error: error.message });
//     }
// };

export const getSearchSuggestions = async (req, res) => {
    const { query } = req.query;

    if (!query || typeof query !== "string") {
        return res.status(400).json({ message: "Invalid query parameter" });
    }

    try {
        const searchRegex = { $regex: query, $options: "i" };

        const products = await Product.find(
            {
                $or: [
                    { product_name: searchRegex },    // search by title
                    { brand_name: searchRegex },      // search by brand

                    // ⭐ NEW: search brand + product combined (UI title)
                    {
                        $expr: {
                            $regexMatch: {
                                input: { $concat: ["$brand_name", " ", "$product_name"] },
                                regex: query,
                                options: "i"
                            }
                        }
                    }
                ]
            },
            {
                slug: 1,
                product_name: 1,
                brand_name: 1,
                product_image: 1,
                awin_image_url: 1,
            }
        )
            .limit(20)
            .lean();

        const suggestions = products.map(p => ({
            slug: p.slug,
            name: p.product_name,
            brand: p.brand_name,
            image: p.product_image || p.awin_image_url,
            type: "Produkt",
        }));

        res.status(200).json(suggestions);

    } catch (error) {
        console.error("Error fetching search suggestions:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};


// POST /api/products/upload-csv
// export const getSearchSuggestions = async (req, res) => {
//     const { query } = req.query;

//     if (!query || typeof query !== 'string') {
//         return res.status(400).json({ message: 'Invalid query parameter' });
//     }

//     try {
//         const searchRegex = { $regex: query, $options: 'i' };

//         // ✅ Only search product_name and optionally brand_name
//         const products = await Product.find(
//             {
//                 $or: [
//                     { product_name: searchRegex },
//                     { brand_name: searchRegex }, // optional: allows "Michelin" to match products too
//                 ],
//             },
//             {
//                 slug: 1,
//                 product_name: 1,
//                 brand_name: 1,
//                 product_image: 1,
//                 _id: 0,
//             }
//         )
//             .limit(20)
//             .lean();

//         // ✅ Return only product suggestions
//         const suggestions = products.map((p) => ({
//             slug: p.slug,
//             name: p.product_name,
//             brand: p.brand_name || null,
//             image: p.product_image || null,
//             type: 'Produkt',
//         }));

//         res.status(200).json(suggestions);
//     } catch (error) {
//         console.error('Error fetching search suggestions:', error);
//         res.status(500).json({ message: 'Server error', error: error.message });
//     }
// };

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