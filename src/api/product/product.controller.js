import Product from '../../models/product.js';
import { startCsvImportAsync } from "./importAWINCsv.js";


// In your product controller file

export const productLists = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 12,
            sort = 'createdAt',
            order = 'desc',
            mode,
            category,
            brand,
            width,
            height,
            diameter,
            speedIndex,
            lastIndex,
            noise,
            fuelClass,
            wetGrip,
        } = req.query;

        const query = {};

        // Apply filters to the query (for product filtering)
        if (category) query.merchant_product_third_category = category;
        if (brand) query.brand_name = brand;
        if (width) query.width = width;
        if (height) query.height = height;
        if (diameter) query.diameter = diameter;
        if (speedIndex) query.speedIndex = speedIndex;
        if (lastIndex) query.lastIndex = lastIndex;
        if (noise) query.noise_class = noise;
        if (fuelClass) query.fuel_class = fuelClass;
        if (wetGrip) query.wet_grip = wetGrip;

              
                // Utility functions
                const getPriceRange = async () => {
                    const prices = await Product.find(query).select('search_price');
                    const validPrices = prices.map(p => parseFloat(p.search_price)).filter(p => !isNaN(p));
                    const min = validPrices.length ? Math.min(...validPrices) : 0;
                    const max = validPrices.length ? Math.max(...validPrices) : 0;
                    return { minPrices: min, maxPrices: max };
                };

                // Get product counts for filters
                const getCategoryCounts = async () => {
                    const categoryMatch = { ...query };
                    delete categoryMatch.merchant_product_third_category;
                    const products = await Product.find(categoryMatch, 'merchant_product_third_category');
                    const counts = {};
                    products.forEach(p => {
                        const cat = p.merchant_product_third_category || "Unknown";
                        counts[cat] = (counts[cat] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

                const getBrandCounts = async () => {
                    const brandMatch = { ...query };
                    delete brandMatch.brand_name;
                    const products = await Product.find(brandMatch, 'brand_name');
                    const counts = {};
                    products.forEach(p => {
                        const brand = p.brand_name || "Unknown";
                        counts[brand] = (counts[brand] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

                const getWidthCounts = async () => {
                    const widthMatch = { ...query };
                    delete widthMatch.width;
                    const products = await Product.find(widthMatch, 'width');
                    const counts = {};
                    products.forEach(p => {
                        const width = p.width || '';
                        counts[width] = (counts[width] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };
                // Get height counts
                const getHeightCounts = async () => {
                    const heightMatch = { ...query };
                    delete heightMatch.height;
                    const products = await Product.find(heightMatch, 'height');
                    const counts = {};
                    products.forEach((p) => {
                        const height = p.height || '';
                        counts[height] = (counts[height] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

                // Get diameter counts
                const getDiameterCounts = async () => {
                    const diameterMatch = { ...query };
                    delete diameterMatch.diameter;
                    const products = await Product.find(diameterMatch, 'diameter');
                    const counts = {};
                    products.forEach((p) => {
                        const diameter = p.diameter || '';
                        counts[diameter] = (counts[diameter] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };


                // Get speed index counts using extractIndexesFromProductName
                const getSpeedIndexCounts = async () => {
                    const speedMatch = { ...query };
                    delete speedMatch.speedIndex;
                    const products = await Product.find(speedMatch, 'speedIndex');
                    const counts = {};
                    products.forEach((p) => {
                        const speedIndex = p.speedIndex || '';
                        if (speedIndex) {
                            counts[speedIndex] = (counts[speedIndex] || 0) + 1;
                        }
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

                // Get last index counts using extractIndexesFromProductName
                const getLastIndexCounts = async () => {
                    const lastIndexMatch = { ...query };
                    delete lastIndexMatch.lastIndex;
                    const products = await Product.find(lastIndexMatch, 'lastIndex');
                    const counts = {};
                    products.forEach((p) => {
                        const lastIndex = p.lastIndex || '';
                        if (lastIndex) {
                            counts[lastIndex] = (counts[lastIndex] || 0) + 1;
                        }
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
              };

                // Get noise counts
                const getNoiseCounts = async () => {
                    const noiseMatch = { ...query };
                    delete noiseMatch.noise_class;
                    const products = await Product.find(noiseMatch, 'noise_class');
                    const counts = {};
                    products.forEach((p) => {
                        const noise = p.noise_class || "Unknown";
                        counts[noise] = (counts[noise] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

                // Get fuel class counts
                const getFuelClassCounts = async () => {
                    const fuelClassMatch = { ...query };
                    delete fuelClassMatch.fuel_class;
                    const products = await Product.find(fuelClassMatch, 'fuel_class');
                    const counts = {};
                    products.forEach((p) => {
                        const fuelClass = p.fuel_class || "Unknown";
                        counts[fuelClass] = (counts[fuelClass] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

                // Get wet grip counts
                const getWetGripCounts = async () => {
                    const wetGripMatch = { ...query };
                    delete wetGripMatch.wet_grip;
                    const products = await Product.find(wetGripMatch, 'wet_grip');
                    const counts = {};
                    products.forEach((p) => {
                        const wetGrip = p.wet_grip || "Unknown";
                        counts[wetGrip] = (counts[wetGrip] || 0) + 1;
                    });
                    return Object.entries(counts).map(([name, count]) => ({ name, count }));
                };

        // Fetch product list with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOption = { [sort]: order === 'asc' ? 1 : -1 };

        const [total, products, priceRange] = await Promise.all([
            Product.countDocuments(query),
            Product.find(query).sort(sortOption).skip(skip).limit(+limit).select('brand_logo fuel_class product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price'),
            getPriceRange(),
        ]);

        // Get the filter counts in parallel
        const [
            categories,
            brands,
            widths,
            heights,
            diameters,
            speedIndexes,
            lastIndexes,
            noises,
            fuelClasses,
            wetGrips,
        ] = await Promise.all([
            getCategoryCounts(),
            getBrandCounts(),
            getWidthCounts(),
            getHeightCounts(),
            getDiameterCounts(),
            getSpeedIndexCounts(),
            getLastIndexCounts(),
            getNoiseCounts(),
            getFuelClassCounts(),
            getWetGripCounts(),
        ]);

        return res.status(200).json({
            total,
            products,
            ...priceRange,

            // widths,
            // heights,
            // diameters,
            // speedIndexes,
            // lastIndexes,
            // noises,
            // fuelClasses,
            // wetGrips,
            filterGroups: {
                categories,
                brands,
                widths,
                heights,
                diameters,
                speedIndexes,
                lastIndexes,
                noises,
                fuelClasses,
                wetGrips,
            },
        });

    } catch (err) {
        console.error('Error in productLists:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};
// export const productLists = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 12,
//             sort = 'createdAt',
//             order = 'desc',
//             category,
//             brand,
//             width,
//             height,
//             diameter,
//             speedIndex,
//             lastIndex,
//             noise,
//             fuelClass,
//             wetGrip,
//             minPrice = 0,
//             maxPrice = 10000,
//         } = req.query;

//         const match = {
//             ...(category && { merchant_product_third_category: category }),
//             ...(brand && { brand_name: brand }),
//             ...(width && { width }),
//             ...(height && { height }),
//             ...(diameter && { diameter }),
//             ...(speedIndex && { speedIndex }),
//             ...(lastIndex && { lastIndex }),
//             ...(noise && { noise_class: noise }),
//             ...(fuelClass && { fuel_class: fuelClass }),
//             ...(wetGrip && { wet_grip: wetGrip }),
//             search_price: {
//                 $gte: parseFloat(minPrice),
//                 $lte: parseFloat(maxPrice),
//             },
//         };

//         const pipeline = [
//             { $match: match },
//             {
//                 $facet: {
//                     paginatedResults: [
//                         { $sort: { [sort]: order === 'asc' ? 1 : -1 } },
//                         { $skip: (page - 1) * parseInt(limit) },
//                         { $limit: parseInt(limit) },
//                     ],
//                     totalCount: [{ $count: 'count' }],
//                     priceBounds: [
//                         {
//                             $group: {
//                                 _id: null,
//                                 min: { $min: '$search_price' },
//                                 max: { $max: '$search_price' },
//                             },
//                         },
//                     ],
//                     brands: [
//                         { $group: { _id: '$brand_name', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     categories: [
//                         { $group: { _id: '$merchant_product_third_category', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     widths: [
//                         { $group: { _id: '$width', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     heights: [
//                         { $group: { _id: '$height', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     diameters: [
//                         { $group: { _id: '$diameter', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     speedIndexes: [
//                         { $group: { _id: '$speedIndex', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     lastIndexes: [
//                         { $group: { _id: '$lastIndex', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     noises: [
//                         { $group: { _id: '$noise_class', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     fuelClasses: [
//                         { $group: { _id: '$fuel_class', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                     wetGrips: [
//                         { $group: { _id: '$wet_grip', count: { $sum: 1 } } },
//                         { $project: { name: '$_id', count: 1, _id: 0 } },
//                     ],
//                 },
//             },
//         ];

//         const [result] = await Product.aggregate(pipeline);
//         const products = result.paginatedResults;
//         const total = result.totalCount[0]?.count || 0;
//         const minPrices = result.priceBounds[0]?.min || 0;
//         const maxPrices = result.priceBounds[0]?.max || 0;

//         return res.json({
//             total,
//             products,
//             minPrices,
//             maxPrices,
//             filterGroups: {
//                 brands: result.brands,
//                 categories: result.categories,
//                 widths: result.widths,
//                 heights: result.heights,
//                 diameters: result.diameters,
//                 speedIndexes: result.speedIndexes,
//                 lastIndexes: result.lastIndexes,
//                 noises: result.noises,
//                 fuelClasses: result.fuelClasses,
//                 wetGrips: result.wetGrips,
//             },
//         });
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ message: 'Server error' });
//     }
// };
  

// ========================================


/**
 * Fetch product details by productId (either `ean`, `aw_product_id`, or MongoDB `_id`).
 * Also fetches up to 4 related products from the same category, product category, and with matching width, height, diameter, lastIndex, and speedIndex (excluding the current product).
 */
// export const getProductDetails = async (req, res) => {
//     const { productId } = req.params;

//     // Utility to parse tyre dimensions
//     const parseTyreDimensions = (dim) => {
//         if (!dim) return { width: '', height: '', diameter: '' };
//         const match =
//             dim.match(/^(\d+)[ /-](\d+)[ /-]R\s?(\d+)$/i) ||
//             dim.match(/^(\d+)[ /-](\d+)[ /-](\d+)$/i) ||
//             dim.match(/^(\d+)\/(\d+)R(\d+)$/i) ||
//             dim.match(/^(\d+)\/(\d+)\/?R?(\d+)$/i);
//         if (match) {
//             return { width: match[1], height: match[2], diameter: match[3] };
//         }
//         const rMatch = dim.match(/R\s?(\d+)/i);
//         const parts = dim.match(/\d+/g) || [];
//         return {
//             width: parts[0] || '',
//             height: parts[1] || '',
//             diameter: rMatch ? rMatch[1] : parts[2] || '',
//         };
//     };

//     // Utility to extract speed index and last index from product name
//     const extractIndexesFromProductName = (productName) => {
//         const matches = productName.match(/\b(\d{2,3})([A-Z]{1,2})\b/g) || [];
//         const rIdx = productName.search(/\bR\d+\b/i);
//         if (rIdx === -1) return { lastIndex: '', speedIndex: '' };
//         const tail = productName.substring(rIdx + 2); // skip "R" and digits
//         const idxMatch = tail.match(/\b(\d{2,3})([A-Z]{1,2})\b/);
//         if (idxMatch) {
//             return { lastIndex: idxMatch[1], speedIndex: idxMatch[2] };
//         }
//         if (matches.length > 0) {
//             const m = matches[0].match(/(\d{2,3})([A-Z]{1,2})/);
//             if (m) return { lastIndex: m[1], speedIndex: m[2] };
//         }
//         return { lastIndex: '', speedIndex: '' };
//     };

//     try {
//         // Try to find by MongoDB _id, ean, or aw_product_id
//         let product = await Product.findOne({
//             $or: [
//                 { _id: productId },
//                 { ean: productId },
//                 { aw_product_id: productId }
//             ]
//         });

//         if (!product) {
//             return res.status(404).json({ message: "Product not found" });
//         }

//         // Parse dimensions and indexes for filtering related products
//         const { width, height, diameter } = parseTyreDimensions(product.dimensions || '');
//         const { lastIndex, speedIndex } = extractIndexesFromProductName(product.product_name || '');

//         // Build related product filter
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


//         // Fetch related products by filters, excluding the current product
//         const relatedProducts = await Product.find(relatedFilter).limit(10);

//         return res.status(200).json({ product, relatedProducts });
//     } catch (err) {
//         console.error('Error fetching product details:', err);
//         return res.status(500).json({ message: 'Server error' });
//     }
// };
// Simple in-memory cache
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

export const getProductDetails = async (req, res) => {
    const { productId } = req.params;

    // Utils
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
        });

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // Cache key based on filters
        const cacheKey = `related:${product._id}`;
        const cached = getCachedRelatedProducts(cacheKey);
        if (cached) {
            return res.status(200).json({ product, relatedProducts: cached });
        }

        const { width, height, diameter } = parseTyreDimensions(product.dimensions || '');
        const { lastIndex, speedIndex } = extractIndexesFromProductName(product.product_name || '');

        const relatedFilter = {
            merchant_product_third_category: product.merchant_product_third_category,
            product_category: product.product_category,
            _id: { $ne: product._id }
        };

        if (width) relatedFilter.dimensions = new RegExp(`^${width}[ /-]`);
        if (height) relatedFilter.dimensions = new RegExp(`[ /-]${height}[ /-]`);
        if (diameter) relatedFilter.dimensions = new RegExp(`R?${diameter}$`, 'i');
        if (speedIndex) relatedFilter.product_name = new RegExp(`\\d{2,3}${speedIndex}`, 'i');
        if (lastIndex) relatedFilter.product_name = new RegExp(`\\b${lastIndex}[A-Z]{1,2}\\b`, 'i');

        // Fetch all matching
        const allMatchingProducts = await Product.find(relatedFilter)
            .select('product_name brand_name brand_logo dimensions search_price product_image createdAt fuel_class wet_grip noise_class speedIndex lastIndex')
            .sort({ createdAt: -1, search_price: 1 }) // sort by newest and lowest price
            .lean();

        // Group by brand
        const brandMap = new Map();
        for (const p of allMatchingProducts) {
            if (!brandMap.has(p.brand_name)) {
                brandMap.set(p.brand_name, p);
            }
            if (brandMap.size >= 10) break;
        }

        const relatedProducts = Array.from(brandMap.values());

        // Store in cache
        setCachedRelatedProducts(cacheKey, relatedProducts);

        return res.status(200).json({ product, relatedProducts });
    } catch (err) {
        console.error('Error fetching product details:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};


export const getBrandSummary = async (req, res) => {
    try {
        // Define the query object, this will be empty to fetch all brands
        const query = {};

        // Fetch all products and group them by brand_name to get the total product count for each brand
        const products = await Product.find(query, 'brand_name brand_logo');  // Only fetching brand_name and brand_logo fields

        const brandCounts = {};

        // Iterate through the products to accumulate counts of products per brand
        products.forEach((product) => {
            const brandName = product.brand_name || "Unknown";  // Default to "Unknown" if no brand name is provided
            if (!brandCounts[brandName]) {
                brandCounts[brandName] = {
                    brand_name: brandName,
                    brandLogo: product.brand_logo || "",  // Default logo if none is available
                    count: 0,
                };
            }
            brandCounts[brandName].count += 1;  // Increment product count for the brand
        });

        // Convert the brandCounts object into an array for the response
        const brandSummary = Object.values(brandCounts);

        // Send the brand summary as the response
        res.status(200).json({
            message: "Brand summary with product counts",
            brands: brandSummary,
        });

    } catch (error) {
        console.error('Error fetching brand summary:', error);
        res.status(500).json({
            message: "Server error",
            error: error.message || String(error),
        });
    }
};

export const getLatestProducts = async (req, res) => {
    try {
        const latestProducts = await Product.aggregate([
            // Sort by creation time, newest first
            { $sort: { createdAt: -1 } },

            // Group by brand_name, pick the first (latest) product per brand
            {
                $group: {
                    _id: "$brand_name",
                    product: { $first: "$$ROOT" },
                }
            },

            // Flatten the grouped product object
            {
                $replaceRoot: { newRoot: "$product" }
            },

            // Limit to top 10 latest distinct-brand products
            { $limit: 10 }
        ]);

        if (!latestProducts.length) {
            return res.status(404).json({ message: "No products found." });
        }

        return res.status(200).json({
            message: "Latest 10 products (one per brand)",
            products: latestProducts,
        });

    } catch (error) {
        console.error("Error fetching latest products:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message || String(error),
        });
    }
  };


export const getLatestWinterProducts = async (req, res) => {
    try {
        const latestWinterProducts = await Product.aggregate([
            {
                $match: {
                    merchant_product_third_category: 'Winterreifen',
                },
            },
            {
                $sort: {
                    createdAt: -1, // Ensure the latest products come first
                },
            },
            {
                $group: {
                    _id: '$brand_name',
                    product: { $first: '$$ROOT' }, // Pick the latest product per brand
                },
            },
            {
                $replaceRoot: { newRoot: '$product' },
            },
            {
                $limit: 10,
            },
        ]);

        if (!latestWinterProducts.length) {
            return res
                .status(404)
                .json({ message: 'No winter products found.' });
        }

        return res.status(200).json({
            message: 'Latest 10 Winterreifen Products (one per brand)',
            products: latestWinterProducts,
        });
    } catch (error) {
        console.error('Error fetching latest winter products:', error);
        return res
            .status(500)
            .json({ message: 'Server error', error: error.message });
    }
};
  


export const GetFilterTyres = async (req, res) => {
    try {
        const { category, width, height, diameter } = req.query;

        // Build the base match query
        const baseQuery = {};
        if (category) baseQuery.merchant_product_third_category = category;
        if (width) baseQuery.width = width;
        if (height) baseQuery.height = height;
        if (diameter) baseQuery.diameter = diameter;

        // Helper function to build aggregation pipeline for a field
        const buildFacetPipeline = (fieldToGroup, removeFieldFromQuery) => {
            const matchStage = { ...baseQuery };
            delete matchStage[removeFieldFromQuery]; // Avoid filtering the same field we're grouping

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

        // Aggregate all 4 filters in parallel using $facet
        const result = await Product.aggregate([
            {
                $facet: {
                    categories: buildFacetPipeline('merchant_product_third_category', 'merchant_product_third_category'),
                    widths: buildFacetPipeline('width', 'width'),
                    heights: buildFacetPipeline('height', 'height'),
                    diameters: buildFacetPipeline('diameter', 'diameter'),
                },
            },
        ]);

        const { categories, widths, heights, diameters } = result[0];

        return res.status(200).json({
            categories,
            widths,
            heights,
            diameters,
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