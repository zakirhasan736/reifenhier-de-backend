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
                .select(
                    'brand_logo fuel_class related_cheaper slug in_stock product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price main_price merchant_product_category_path merchant_product_second_category cheapest_offer expensive_offer speedIndex lastIndex width height diameter ean offers savings_percent total_offers average_rating review_count'
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
                    offers: Array.isArray(product.offers)
                        ? product.offers.map(o => ({
                            ...o,
                            price: typeof o.price === "number"
                                ? o.price.toFixed(2).replace(".", ",")
                                : "0,00",
                        }))
                        : [],
                    savings_percent: product.savings_percent || "0%",
                    total_offers: product.total_offers || (product.offers?.length || 1),
                    zum_angebot_url: product.offers?.[0]?.aw_deep_link || "",
                    vendor_name: product.offers?.[0]?.vendor || "",
                    vendor_logo: product.offers?.[0]?.vendor_logo || "",
                    // related_cheaper: await getCompetitors(product, 3)
                })));

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
                    slug: 1,
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
            offers: Array.isArray(p.offers)
                ? p.offers.map(o => ({
                    ...o,
                    price: typeof o.price === "number"
                        ? o.price.toFixed(2).replace(".", ",")
                        : "0,00",
                }))
                : []
        }));

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
            offers: Array.isArray(p.offers)
                ? p.offers.map(o => ({
                    ...o,
                    price: typeof o.price === "number"
                        ? o.price.toFixed(2).replace(".", ",")
                        : "0,00",
                }))
                : []
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

  

// POST /api/products/upload-csv
export const getSearchSuggestions = async (req, res) => {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Invalid query parameter' });
    }

    try {
        const searchRegex = { $regex: query, $options: 'i' };

        // ✅ Only search product_name and optionally brand_name
        const products = await Product.find(
            {
                $or: [
                    { product_name: searchRegex },
                    { brand_name: searchRegex }, // optional: allows "Michelin" to match products too
                ],
            },
            {
                slug: 1,
                product_name: 1,
                brand_name: 1,
                product_image: 1,
                _id: 0,
            }
        )
            .limit(20)
            .lean();

        // ✅ Return only product suggestions
        const suggestions = products.map((p) => ({
            slug: p.slug,
            name: p.product_name,
            brand: p.brand_name || null,
            image: p.product_image || null,
            type: 'Produkt',
        }));

        res.status(200).json(suggestions);
    } catch (error) {
        console.error('Error fetching search suggestions:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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