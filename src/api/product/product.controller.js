import FeaturedSettings from '../../models/FeaturedSettings.js';
import Product from '../../models/product.js';
import { startCsvImportAsync } from "./importAWINCsv.js";
import { getCompetitors } from '../utils/competitor.js';

// In your product controller file
// export const productLists = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 12,
//             sort = 'createdAt',
//             order = 'desc',
//             mode,
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
//         } = req.query;

//         const query = {};

//         // Apply filters to the query (for product filtering)
//         if (category) query.merchant_product_third_category = category;
//         if (brand) query.brand_name = brand;
//         if (width) query.width = width;
//         if (height) query.height = height;
//         if (diameter) query.diameter = diameter;
//         if (speedIndex) query.speedIndex = speedIndex;
//         if (lastIndex) query.lastIndex = lastIndex;
//         if (noise) query.noise_class = noise;
//         if (fuelClass) query.fuel_class = fuelClass;
//         if (wetGrip) query.wet_grip = wetGrip;

              
//                 // Utility functions
//                 const getPriceRange = async () => {
//                     const prices = await Product.find(query).select('search_price');
//                     const validPrices = prices.map(p => parseFloat(p.search_price)).filter(p => !isNaN(p));
//                     const min = validPrices.length ? Math.min(...validPrices) : 0;
//                     const max = validPrices.length ? Math.max(...validPrices) : 0;
//                     return { minPrices: min, maxPrices: max };
//                 };

//                 // Get product counts for filters
//                 const getCategoryCounts = async () => {
//                     const categoryMatch = { ...query };
//                     delete categoryMatch.merchant_product_third_category;
//                     const products = await Product.find(categoryMatch, 'merchant_product_third_category');
//                     const counts = {};
//                     products.forEach(p => {
//                         const cat = p.merchant_product_third_category || "Unknown";
//                         counts[cat] = (counts[cat] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//                 const getBrandCounts = async () => {
//                     const brandMatch = { ...query };
//                     delete brandMatch.brand_name;
//                     const products = await Product.find(brandMatch, 'brand_name');
//                     const counts = {};
//                     products.forEach(p => {
//                         const brand = p.brand_name || "Unknown";
//                         counts[brand] = (counts[brand] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//                 const getWidthCounts = async () => {
//                     const widthMatch = { ...query };
//                     delete widthMatch.width;
//                     const products = await Product.find(widthMatch, 'width');
//                     const counts = {};
//                     products.forEach(p => {
//                         const width = p.width || '';
//                         counts[width] = (counts[width] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };
//                 // Get height counts
//                 const getHeightCounts = async () => {
//                     const heightMatch = { ...query };
//                     delete heightMatch.height;
//                     const products = await Product.find(heightMatch, 'height');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const height = p.height || '';
//                         counts[height] = (counts[height] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//                 // Get diameter counts
//                 const getDiameterCounts = async () => {
//                     const diameterMatch = { ...query };
//                     delete diameterMatch.diameter;
//                     const products = await Product.find(diameterMatch, 'diameter');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const diameter = p.diameter || '';
//                         counts[diameter] = (counts[diameter] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };


//                 // Get speed index counts using extractIndexesFromProductName
//                 const getSpeedIndexCounts = async () => {
//                     const speedMatch = { ...query };
//                     delete speedMatch.speedIndex;
//                     const products = await Product.find(speedMatch, 'speedIndex');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const speedIndex = p.speedIndex || '';
//                         if (speedIndex) {
//                             counts[speedIndex] = (counts[speedIndex] || 0) + 1;
//                         }
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//                 // Get last index counts using extractIndexesFromProductName
//                 const getLastIndexCounts = async () => {
//                     const lastIndexMatch = { ...query };
//                     delete lastIndexMatch.lastIndex;
//                     const products = await Product.find(lastIndexMatch, 'lastIndex');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const lastIndex = p.lastIndex || '';
//                         if (lastIndex) {
//                             counts[lastIndex] = (counts[lastIndex] || 0) + 1;
//                         }
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//               };

//                 // Get noise counts
//                 const getNoiseCounts = async () => {
//                     const noiseMatch = { ...query };
//                     delete noiseMatch.noise_class;
//                     const products = await Product.find(noiseMatch, 'noise_class');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const noise = p.noise_class || "Unknown";
//                         counts[noise] = (counts[noise] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//                 // Get fuel class counts
//                 const getFuelClassCounts = async () => {
//                     const fuelClassMatch = { ...query };
//                     delete fuelClassMatch.fuel_class;
//                     const products = await Product.find(fuelClassMatch, 'fuel_class');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const fuelClass = p.fuel_class || "Unknown";
//                         counts[fuelClass] = (counts[fuelClass] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//                 // Get wet grip counts
//                 const getWetGripCounts = async () => {
//                     const wetGripMatch = { ...query };
//                     delete wetGripMatch.wet_grip;
//                     const products = await Product.find(wetGripMatch, 'wet_grip');
//                     const counts = {};
//                     products.forEach((p) => {
//                         const wetGrip = p.wet_grip || "Unknown";
//                         counts[wetGrip] = (counts[wetGrip] || 0) + 1;
//                     });
//                     return Object.entries(counts).map(([name, count]) => ({ name, count }));
//                 };

//         // Fetch product list with pagination
//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortOption = { [sort]: order === 'asc' ? 1 : -1 };

//         const [total, products, priceRange] = await Promise.all([
//             Product.countDocuments(query),
//             Product.find(query).sort(sortOption).skip(skip).limit(+limit).select('brand_logo fuel_class product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price'),
//             getPriceRange(),
//         ]);

//         // Get the filter counts in parallel
//         const [
//             categories,
//             brands,
//             widths,
//             heights,
//             diameters,
//             speedIndexes,
//             lastIndexes,
//             noises,
//             fuelClasses,
//             wetGrips,
//         ] = await Promise.all([
//             getCategoryCounts(),
//             getBrandCounts(),
//             getWidthCounts(),
//             getHeightCounts(),
//             getDiameterCounts(),
//             getSpeedIndexCounts(),
//             getLastIndexCounts(),
//             getNoiseCounts(),
//             getFuelClassCounts(),
//             getWetGripCounts(),
//         ]);

//         return res.status(200).json({
//             total,
//             products,
//             ...priceRange,

//             // widths,
//             // heights,
//             // diameters,
//             // speedIndexes,
//             // lastIndexes,
//             // noises,
//             // fuelClasses,
//             // wetGrips,
//             filterGroups: {
//                 categories,
//                 brands,
//                 widths,
//                 heights,
//                 diameters,
//                 speedIndexes,
//                 lastIndexes,
//                 noises,
//                 fuelClasses,
//                 wetGrips,
//             },
//         });

//     } catch (err) {
//         console.error('Error in productLists:', err);
//         return res.status(500).json({ message: 'Server error' });
//     }
// };
// controllers/product.controller.js

// const redis = new Redis({ host: 'localhost', port: 6379 }); // Use IP for production

// export const productLists = async (req, res) => {
//     try {
//         const {
//             limit = 12,
//             sort = 'createdAt',
//             order = 'desc',
//             lastId, // For keyset
//         } = req.query;

//         const toArray = (val) =>
//             Array.isArray(val)
//                 ? val
//                 : val
//                     ? typeof val === 'string'
//                         ? val.split(',').filter(Boolean)
//                         : [val]
//                     : [];

//         const filters = {
//             ...(req.query.category && {
//                 merchant_product_third_category: { $in: toArray(req.query.category) },
//             }),
//             ...(req.query.brand && {
//                 brand_name: { $in: toArray(req.query.brand) },
//             }),
//             ...(req.query.width && {
//                 width: { $in: toArray(req.query.width) },
//             }),
//             ...(req.query.height && {
//                 height: { $in: toArray(req.query.height) },
//             }),
//             ...(req.query.diameter && {
//                 diameter: { $in: toArray(req.query.diameter) },
//             }),
//             ...(req.query.speedIndex && {
//                 speedIndex: { $in: toArray(req.query.speedIndex) },
//             }),
//             ...(req.query.lastIndex && {
//                 lastIndex: { $in: toArray(req.query.lastIndex) },
//             }),
//             ...(req.query.noise && {
//                 noise_class: { $in: toArray(req.query.noise) },
//             }),
//             ...(req.query.fuelClass && {
//                 fuel_class: { $in: toArray(req.query.fuelClass) },
//             }),
//             ...(req.query.wetGrip && {
//                 wet_grip: { $in: toArray(req.query.wetGrip) },
//             }),
//         };

//         const sortField = sort === 'price' ? 'search_price' : 'createdAt';
//         const sortDir = order === 'asc' ? 1 : -1;

//         // Keyset condition
//         if (lastId) {
//             filters._id = { [sortDir === 1 ? '$gt' : '$lt']: lastId };
//         }

//         // Redis key
//         const redisKey = `filters:${hash(filters)}`;
//         let cached = await redis.get(redisKey);
//         let filterData;

//         if (cached) {
//             filterData = JSON.parse(cached);
//         } else {
//             const fieldMap = {
//                 categories: 'merchant_product_third_category',
//                 brands: 'brand_name',
//                 widths: 'width',
//                 heights: 'height',
//                 diameters: 'diameter',
//                 speedIndexes: 'speedIndex',
//                 lastIndexes: 'lastIndex',
//                 noises: 'noise_class',
//                 fuelClasses: 'fuel_class',
//                 wetGrips: 'wet_grip',
//             };

//             const facetStage = {};

//             for (const [facetName, field] of Object.entries(fieldMap)) {
//                 const copyFilter = { ...filters };
//                 delete copyFilter[field];
//                 facetStage[facetName] = [
//                     { $match: copyFilter },
//                     { $group: { _id: `$${field}`, count: { $sum: 1 } } },
//                     { $project: { name: '$_id', count: 1, _id: 0 } },
//                 ];
//             }

//             facetStage.prices = [
//                 { $match: filters },
//                 {
//                     $group: {
//                         _id: null,
//                         min: { $min: '$search_price' },
//                         max: { $max: '$search_price' },
//                     },
//                 },
//             ];

//             const [agg] = await Product.aggregate([{ $facet: facetStage }]);
//             filterData = agg || {};
//             await redis.set(redisKey, JSON.stringify(filterData), 'EX', 60); // TTL: 60s
//         }

//         const products = await Product.find(filters)
//             .sort({ [sortField]: sortDir, _id: sortDir }) // for keyset
//             .limit(+limit)
//             .select(
//                 'brand_logo fuel_class product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price'
//             )
//             .lean();

//         const total = await Product.countDocuments(filters);
//         const price = filterData.prices?.[0] || { min: 0, max: 0 };

//         return res.status(200).json({
//             total,
//             products,
//             lastId: products.length > 0 ? products[products.length - 1]._id : null,
//             minPrices: price.min,
//             maxPrices: price.max,
//             filterGroups: {
//                 categories: filterData.categories || [],
//                 brands: filterData.brands || [],
//                 widths: filterData.widths || [],
//                 heights: filterData.heights || [],
//                 diameters: filterData.diameters || [],
//                 speedIndexes: filterData.speedIndexes || [],
//                 lastIndexes: filterData.lastIndexes || [],
//                 noises: filterData.noises || [],
//                 fuelClasses: filterData.fuelClasses || [],
//                 wetGrips: filterData.wetGrips || [],
//             },
//         });
//     } catch (err) {
//         console.error('Error in productLists:', err);
//         return res.status(500).json({ message: 'Server error' });
//     }
// };

  

// export const productLists = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 12,
//             sort = "createdAt",
//             order = "desc",
//         } = req.query;

//         const toArray = (val) =>
//             Array.isArray(val)
//                 ? val
//                 : val
//                     ? typeof val === "string"
//                         ? val.split(",").filter(Boolean)
//                         : [val]
//                     : [];

//         const filters = {
//             ...(req.query.category && {
//                 merchant_product_third_category: {
//                     $in: toArray(req.query.category),
//                 },
//             }),
//             ...(req.query.brand && {
//                 brand_name: { $in: toArray(req.query.brand) },
//             }),
//             ...(req.query.width && {
//                 width: { $in: toArray(req.query.width) },
//             }),
//             ...(req.query.height && {
//                 height: { $in: toArray(req.query.height) },
//             }),
//             ...(req.query.diameter && {
//                 diameter: { $in: toArray(req.query.diameter) },
//             }),
//             ...(req.query.speedIndex && {
//                 speedIndex: { $in: toArray(req.query.speedIndex) },
//             }),
//             ...(req.query.lastIndex && {
//                 lastIndex: { $in: toArray(req.query.lastIndex) },
//             }),
//             ...(req.query.noise && {
//                 noise_class: { $in: toArray(req.query.noise) },
//             }),
//             ...(req.query.fuelClass && {
//                 fuel_class: { $in: toArray(req.query.fuelClass) },
//             }),
//             ...(req.query.wetGrip && {
//                 wet_grip: { $in: toArray(req.query.wetGrip) },
//             }),
//         };

//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortOption = { [sort]: order === "asc" ? 1 : -1 };

//         const fieldMap = {
//             categories: "merchant_product_third_category",
//             brands: "brand_name",
//             widths: "width",
//             heights: "height",
//             diameters: "diameter",
//             speedIndexes: "speedIndex",
//             lastIndexes: "lastIndex",
//             noises: "noise_class",
//             fuelClasses: "fuel_class",
//             wetGrips: "wet_grip",
//         };

//         const facetStage = {};
//         for (const [facetName, field] of Object.entries(fieldMap)) {
//             const filterCopy = { ...filters };
//             delete filterCopy[field];
//             facetStage[facetName] = [
//                 { $match: filterCopy },
//                 { $group: { _id: `$${field}`, count: { $sum: 1 } } },
//                 { $project: { name: "$_id", count: 1, _id: 0 } },
//             ];
//         }

//         facetStage.prices = [
//             { $match: filters },
//             {
//                 $group: {
//                     _id: null,
//                     min: { $min: "$search_price" },
//                     max: { $max: "$search_price" },
//                 },
//             },
//         ];

//         const [productsRaw, total, agg] = await Promise.all([
//             Product.find(filters)
//                 .sort(sortOption)
//                 .skip(skip)
//                 .limit(+limit)
//                 .select(
//                     "brand_logo fuel_class product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price merchant_product_category_path merchant_product_second_category cheapest_offer speedIndex lastIndex width height diameter ean"
//                 )
//                 .lean(),
//             Product.countDocuments(filters),
//             Product.aggregate([{ $facet: facetStage }]),
//         ]);

//         const products = await Promise.all(
//             productsRaw.map(async (p) => {
//                 const relatedFilter = {
//                     merchant_product_third_category: p.merchant_product_third_category,
//                     width: p.width,
//                     height: p.height,
//                     diameter: p.diameter,
//                     speedIndex: p.speedIndex,
//                     lastIndex: p.lastIndex,
//                     fuel_class: p.fuel_class,
//                     noise_class: p.noise_class,
//                     wet_grip: p.wet_grip,
//                     ean: { $ne: p.ean },
//                 };

//                 const cheaperProducts = await Product.find(relatedFilter)
//                     .sort({ search_price: 1 })
//                     .limit(3)
//                     .select("brand_name product_url _id product_name search_price")
//                     .lean();

//                 const related_cheaper = cheaperProducts.map((r) => ({
//                     _id: r._id,
//                     product_name: r.product_name,
//                     brand_name: r.brand_name,
//                     price: `${r.search_price.toFixed(2).replace(".", ",")} €`,
//                     url: r.product_url,
//                 }));

//                 return {
//                     ...p,
//                     formatted_price:
//                         typeof p.search_price === "number"
//                             ? `${p.search_price.toFixed(2).replace(".", ",")} €`
//                             : "0,00 €",
//                     related_cheaper,
//                 };
//             })
//         );

//         const result = agg[0] || {};
//         const priceData = result.prices?.[0] || { min: 0, max: 0 };

//         return res.status(200).json({
//             total,
//             products,
//             minPrices: priceData.min,
//             maxPrices: priceData.max,
//             filterGroups: {
//                 categories: result.categories || [],
//                 brands: result.brands || [],
//                 widths: result.widths || [],
//                 heights: result.heights || [],
//                 diameters: result.diameters || [],
//                 speedIndexes: result.speedIndexes || [],
//                 lastIndexes: result.lastIndexes || [],
//                 noises: result.noises || [],
//                 fuelClasses: result.fuelClasses || [],
//                 wetGrips: result.wetGrips || [],
//             },
//         });
//     } catch (err) {
//         console.error("Error in productLists:", err);
//         return res.status(500).json({ message: "Server error" });
//     }
// };


// Make sure you have this index in MongoDB for best performance:
// db.products.createIndex({
//   merchant_product_third_category: 1,
//   product_category: 1,
//   width: 1,
//   height: 1,
//   diameter: 1,
//   speedIndex: 1,
//   lastIndex: 1,
//   search_price: 1
// })

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
                    "brand_logo fuel_class in_stock product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price main_price merchant_product_category_path merchant_product_second_category cheapest_offer expensive_offer speedIndex lastIndex width height diameter ean offers savings_percent total_offers average_rating review_count"
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
            related_cheaper: await getCompetitors(product, 3)
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



// export const productLists = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 12,
//             sort = "createdAt",
//             order = "desc",
//         } = req.query;

//         const toArray = (val) =>
//             Array.isArray(val)
//                 ? val
//                 : val
//                     ? typeof val === "string"
//                         ? val.split(",").filter(Boolean)
//                         : [val]
//                     : [];

//         // Build filters for search
//         const filters = {
//             ...(req.query.category && {
//                 merchant_product_third_category: { $in: toArray(req.query.category) },
//             }),
//             ...(req.query.brand && {
//                 brand_name: { $in: toArray(req.query.brand) },
//             }),
//             ...(req.query.width && {
//                 width: { $in: toArray(req.query.width) },
//             }),
//             ...(req.query.height && {
//                 height: { $in: toArray(req.query.height) },
//             }),
//             ...(req.query.diameter && {
//                 diameter: { $in: toArray(req.query.diameter) },
//             }),
//             ...(req.query.speedIndex && {
//                 speedIndex: { $in: toArray(req.query.speedIndex) },
//             }),
//             ...(req.query.lastIndex && {
//                 lastIndex: { $in: toArray(req.query.lastIndex) },
//             }),
//             ...(req.query.noise && {
//                 noise_class: { $in: toArray(req.query.noise) },
//             }),
//             ...(req.query.fuelClass && {
//                 fuel_class: { $in: toArray(req.query.fuelClass) },
//             }),
//             ...(req.query.wetGrip && {
//                 wet_grip: { $in: toArray(req.query.wetGrip) },
//             }),
//         };

//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortOption = { [sort]: order === "asc" ? 1 : -1 };

//         // For faceted search (filters)
//         const fieldMap = {
//             categories: "merchant_product_third_category",
//             brands: "brand_name",
//             widths: "width",
//             heights: "height",
//             diameters: "diameter",
//             speedIndexes: "speedIndex",
//             lastIndexes: "lastIndex",
//             noises: "noise_class",
//             fuelClasses: "fuel_class",
//             wetGrips: "wet_grip",
//         };

//         const facetStage = {};
//         for (const [facetName, field] of Object.entries(fieldMap)) {
//             const filterCopy = { ...filters };
//             delete filterCopy[field];
//             facetStage[facetName] = [
//                 { $match: filterCopy },
//                 { $group: { _id: `$${field}`, count: { $sum: 1 } } },
//                 { $project: { name: "$_id", count: 1, _id: 0 } },
//             ];
//         }

//         facetStage.prices = [
//             { $match: filters },
//             {
//                 $group: {
//                     _id: null,
//                     min: { $min: "$search_price" },
//                     max: { $max: "$search_price" },
//                 },
//             },
//         ];

//         // Main data fetch (products, count, facets)
//         const [productsRaw, total, agg] = await Promise.all([
//             Product.find(filters)
//                 .sort(sortOption)
//                 .skip(skip)
//                 .limit(+limit)
//                 .select(
//                     "brand_logo fuel_class in_stock product_image related_cheaper savings_amount wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name main_price search_price merchant_product_category_path merchant_product_second_category cheapest_offer expensive_offer speedIndex lastIndex width height diameter ean offers savings_percent total_offers average_rating review_count"
//                 )
//                 .lean(),
//             Product.countDocuments(filters),
//             Product.aggregate([{ $facet: facetStage }]),
//         ]);

//         // For each product, fetch up to 3 cheaper related products (by brand, lowest per brand)
//         const products = await Promise.all(
//             productsRaw.map(async (p) => {
//                 const relatedFilter = {
//                     merchant_product_third_category: p.merchant_product_third_category,
//                     product_category: p.product_category,
//                     width: p.width,
//                     height: p.height,
//                     diameter: p.diameter,
//                     speedIndex: p.speedIndex,
//                     lastIndex: p.lastIndex,
//                     _id: { $ne: p._id }, // exclude self by MongoDB _id
//                 };

//                 // Find all related products (not limited to 3 yet)
//                 const relatedProducts = await Product.find(relatedFilter)
//                     .sort({ search_price: 1 })
//                     .select("_id brand_name product_name product_url search_price")
//                     .lean();

//                 // Group by brand, keep only the lowest price per brand
//                 const brandMap = new Map();
//                 for (const prod of relatedProducts) {
//                     if (!prod.brand_name) continue;
//                     if (
//                         !brandMap.has(prod.brand_name) ||
//                         (typeof prod.search_price === 'number' && prod.search_price < brandMap.get(prod.brand_name).search_price)
//                     ) {
//                         brandMap.set(prod.brand_name, prod);
//                     }
//                 }
//                 // Sort by price, pick max 3
//                 const cheapestPerBrand = Array.from(brandMap.values())
//                     .sort((a, b) => (a.search_price || 0) - (b.search_price || 0))
//                     .slice(0, 3);

//                 // Utility function for price formatting
//                 const formatPrice = (value) =>
//                     typeof value === "number"
//                         ? `${value.toFixed(2).replace(".", ",")}`
//                         : "0,00";

//                 const cheapest_offer = formatPrice(p.cheapest_offer);
//                 const search_price = formatPrice(p.search_price);
//                 const main_price = formatPrice(p.main_price);
//                 const expensive_offer = formatPrice(p.expensive_offer);

//                 return {
//                     ...p,
//                     cheapest_offer,
//                     expensive_offer,
//                     search_price,
//                     main_price,
//                     savings_percent: p.savings_percent || "0%",
//                     total_offers: p.total_offers || (p.offers?.length || 1),
//                     zum_angebot_url: p.offers?.[0]?.aw_deep_link || "",
//                     vendor_name: p.offers?.[0]?.vendor || "",
//                     vendor_logo: p.offers?.[0]?.vendor_logo || "",
//                     // Array of up to 3 related cheapest (by brand)
//                     related_cheaper: cheapestPerBrand.map((r) => ({
//                         _id: r._id,
//                         brand_name: r.brand_name,
//                         product_name: r.product_name,
//                         url: r.product_url,
//                         price: typeof r.search_price === "number"
//                             ? `${r.search_price.toFixed(2).replace(".", ",")}`
//                             : "0,00",
//                     })),
//                 };
//             })
//         );

//         const result = agg[0] || {};
//         const priceData = result.prices?.[0] || { min: 0, max: 0 };

//         return res.status(200).json({
//             total,
//             products,
//             minPrices: priceData.min,
//             maxPrices: priceData.max,
//             filterGroups: {
//                 categories: result.categories || [],
//                 brands: result.brands || [],
//                 widths: result.widths || [],
//                 heights: result.heights || [],
//                 diameters: result.diameters || [],
//                 speedIndexes: result.speedIndexes || [],
//                 lastIndexes: result.lastIndexes || [],
//                 noises: result.noises || [],
//                 fuelClasses: result.fuelClasses || [],
//                 wetGrips: result.wetGrips || [],
//             },
//         });
//     } catch (err) {
//         console.error("Error in productLists:", err);
//         return res.status(500).json({ message: "Server error" });
//     }
// };

 
// export const productLists = async (req, res) => {
//     try {
//         const {
//             page = 1,
//             limit = 12,
//             sort = "createdAt",
//             order = "desc",
//         } = req.query;

//         const toArray = (val) =>
//             Array.isArray(val)
//                 ? val
//                 : val
//                     ? typeof val === "string"
//                         ? val.split(",").filter(Boolean)
//                         : [val]
//                     : [];

//         // Build filters for search
//         const filters = {
//             ...(req.query.category && {
//                 merchant_product_third_category: { $in: toArray(req.query.category) },
//             }),
//             ...(req.query.brand && {
//                 brand_name: { $in: toArray(req.query.brand) },
//             }),
//             ...(req.query.width && {
//                 width: { $in: toArray(req.query.width) },
//             }),
//             ...(req.query.height && {
//                 height: { $in: toArray(req.query.height) },
//             }),
//             ...(req.query.diameter && {
//                 diameter: { $in: toArray(req.query.diameter) },
//             }),
//             ...(req.query.speedIndex && {
//                 speedIndex: { $in: toArray(req.query.speedIndex) },
//             }),
//             ...(req.query.lastIndex && {
//                 lastIndex: { $in: toArray(req.query.lastIndex) },
//             }),
//             ...(req.query.noise && {
//                 noise_class: { $in: toArray(req.query.noise) },
//             }),
//             ...(req.query.fuelClass && {
//                 fuel_class: { $in: toArray(req.query.fuelClass) },
//             }),
//             ...(req.query.wetGrip && {
//                 wet_grip: { $in: toArray(req.query.wetGrip) },
//             }),
//         };

//         const skip = (parseInt(page) - 1) * parseInt(limit);
//         const sortOption = { [sort]: order === "asc" ? 1 : -1 };

//         // For faceted search (filters)
//         const fieldMap = {
//             categories: "merchant_product_third_category",
//             brands: "brand_name",
//             widths: "width",
//             heights: "height",
//             diameters: "diameter",
//             speedIndexes: "speedIndex",
//             lastIndexes: "lastIndex",
//             noises: "noise_class",
//             fuelClasses: "fuel_class",
//             wetGrips: "wet_grip",
//         };

//         const facetStage = {};
//         for (const [facetName, field] of Object.entries(fieldMap)) {
//             const filterCopy = { ...filters };
//             delete filterCopy[field];
//             facetStage[facetName] = [
//                 { $match: filterCopy },
//                 { $group: { _id: `$${field}`, count: { $sum: 1 } } },
//                 { $project: { name: "$_id", count: 1, _id: 0 } },
//             ];
//         }

//         facetStage.prices = [
//             { $match: filters },
//             {
//                 $group: {
//                     _id: null,
//                     min: { $min: "$search_price" },
//                     max: { $max: "$search_price" },
//                 },
//             },
//         ];

//         // Main data fetch (products, count, facets)
//         const [productsRaw, total, agg] = await Promise.all([
//             Product.find(filters)
//                 .sort(sortOption)
//                 .skip(skip)
//                 .limit(+limit)
//                 .select(
//                     "brand_logo fuel_class in_stock product_image related_cheaper savings_amount wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name main_price search_price merchant_product_category_path merchant_product_second_category cheapest_offer expensive_offer speedIndex lastIndex width height diameter ean offers savings_percent total_offers average_rating review_count"
//                 )
//                 .lean(),
//             Product.countDocuments(filters),
//             Product.aggregate([{ $facet: facetStage }]),
//         ]);

//         // DRY logic: use the helper for all products
//         const products = await Promise.all(
//             productsRaw.map(async (p) => {
//                 // Utility function for price formatting
//                 const formatPrice = (value) =>
//                     typeof value === "number"
//                         ? `${value.toFixed(2).replace(".", ",")}`
//                         : "0,00";

//                 return {
//                     ...p,
//                     cheapest_offer: formatPrice(p.cheapest_offer),
//                     expensive_offer: formatPrice(p.expensive_offer),
//                     search_price: formatPrice(p.search_price),
//                     main_price: formatPrice(p.main_price),
//                     savings_percent: p.savings_percent || "0%",
//                     total_offers: p.total_offers || (p.offers?.length || 1),
//                     zum_angebot_url: p.offers?.[0]?.aw_deep_link || "",
//                     vendor_name: p.offers?.[0]?.vendor || "",
//                     vendor_logo: p.offers?.[0]?.vendor_logo || "",
//                     related_cheaper: await findRelatedCheaperProducts(p, 3),
//                 };
//             })
//         );

//         const result = agg[0] || {};
//         const priceData = result.prices?.[0] || { min: 0, max: 0 };

//         return res.status(200).json({
//             total,
//             products,
//             minPrices: priceData.min,
//             maxPrices: priceData.max,
//             filterGroups: {
//                 categories: result.categories || [],
//                 brands: result.brands || [],
//                 widths: result.widths || [],
//                 heights: result.heights || [],
//                 diameters: result.diameters || [],
//                 speedIndexes: result.speedIndexes || [],
//                 lastIndexes: result.lastIndexes || [],
//                 noises: result.noises || [],
//                 fuelClasses: result.fuelClasses || [],
//                 wetGrips: result.wetGrips || [],
//             },
//         });
//     } catch (err) {
//         console.error("Error in productLists:", err);
//         return res.status(500).json({ message: "Server error" });
//     }
// };


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
        }).lean();

        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        // FORMAT MAIN PRODUCT PRICES
        const formattedProduct = {
            ...product,
            search_price: formatPrice(product.search_price),
            main_price: formatPrice(product.main_price),
            cheapest_offer: formatPrice(product.cheapest_offer),
            expensive_offer: formatPrice(product.expensive_offer),
        };

        // FORMAT OFFERS IN MAIN PRODUCT
        if (Array.isArray(product.offers)) {
            formattedProduct.offers = product.offers.map(offer => ({
                ...offer,
                price: formatPrice(offer.price),
            }));
        }

        // Cache logic (if you use caching)
        const cacheKey = `related:${product._id}`;
        const cached = getCachedRelatedProducts?.(cacheKey);
        if (cached) {
            // Also format prices in cached related products
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
            .select('product_name brand_name brand_logo dimensions search_price product_image merchant_product_third_category product_url in_stock createdAt fuel_class wet_grip noise_class speedIndex lastIndex average_rating review_count cheapest_offer expensive_offer savings_percent total_offers offers')
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
        // Format related products
        const relatedProducts = Array.from(brandMap.values()).map(p => ({
            ...p,
            search_price: formatPrice(p.search_price),
            cheapest_offer: formatPrice(p.cheapest_offer),
            expensive_offer: formatPrice(p.expensive_offer),
            offers: Array.isArray(p.offers)
                ? p.offers.map(o => ({ ...o, price: formatPrice(o.price) }))
                : []
        }));

        // Save to cache if needed
        setCachedRelatedProducts?.(cacheKey, relatedProducts);

        return res.status(200).json({ product: formattedProduct, relatedProducts });
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
        // 1. Get 500 latest products, but only their minimal info.
        const recentProducts = await Product.find({})
            .sort({ createdAt: -1 })
            .select('brand_name brand_logo product_image product_name in_stock search_price merchant_product_third_category product_url fuel_class wet_grip noise_class dimensions average_rating review_count cheapest_offer expensive_offer savings_percent total_offers offers width height diameter speedIndex lastIndex product_category')
            .limit(500)
            .lean();

        // 2. Pick only the first product per brand
        const seenBrands = new Set();
        const latestUnique = [];
        for (const product of recentProducts) {
            if (!seenBrands.has(product.brand_name)) {
                seenBrands.add(product.brand_name);
                latestUnique.push(product);
            }
            if (latestUnique.length === 10) break;
        }

        if (!latestUnique.length) {
            return res.status(404).json({ message: "No products found." });
        }

        // 3. Prepare competitor facets for aggregation (STRICT filter first)
        const competitorFacets = {};
        latestUnique.forEach((product, idx) => {
            const facetName = `p${idx}`;
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
            competitorFacets[facetName] = [
                { $match: match },
                { $sort: { search_price: 1 } },
                {
                    $group: {
                        _id: "$brand_name",
                        doc: { $first: "$$ROOT" }
                    }
                },
                { $replaceRoot: { newRoot: "$doc" } },
                { $sort: { search_price: 1 } },
                { $limit: 3 },
                {
                    $project: {
                        _id: 1,
                        brand_name: 1,
                        product_name: 1,
                        product_url: 1,
                        search_price: 1
                    }
                }
            ];
        });

        // 4. Run one aggregate facet call for all competitors
        const competitorAgg = await Product.aggregate([{ $facet: competitorFacets }]);
        const competitors = competitorAgg[0];

        // 5. Merge results & fallback to a BROADER search if any product gets less than 3
        const productsWithCompetitors = await Promise.all(latestUnique.map(async (product, idx) => {
            const facetName = `p${idx}`;
            let competitorsList = (competitors[facetName] || []).filter(r => String(r._id) !== String(product._id));
            if (competitorsList.length < 3) {
                // Broader fallback: ignore speedIndex/lastIndex/height for extra competitors
                const broadMatch = {
                    merchant_product_third_category: product.merchant_product_third_category,
                    product_category: product.product_category,
                    width: product.width,
                    diameter: product.diameter,
                    _id: { $ne: product._id }
                };
                Object.keys(broadMatch).forEach(k => (broadMatch[k] == null || broadMatch[k] === "") && delete broadMatch[k]);
                const broadCompetitors = await Product.find(broadMatch)
                    .sort({ search_price: 1 })
                    .select("_id brand_name product_name product_url search_price")
                    .lean();
                for (const c of broadCompetitors) {
                    if (
                        competitorsList.length < 3 &&
                        !competitorsList.some(r => String(r._id) === String(c._id))
                    ) {
                        competitorsList.push(c);
                    }
                }
            }
            return {
                ...product,
                related_cheaper: (competitorsList || []).slice(0, 3).map(r => ({
                    _id: r._id,
                    brand_name: r.brand_name,
                    product_name: r.product_name,
                    url: r.product_url,
                    price: typeof r.search_price === "number"
                        ? r.search_price.toFixed(2).replace(".", ",")
                        : "0,00",
                }))
            };
        }));

        return res.status(200).json({
            message: "Latest 10 products (one per brand, with up to 3 competitors)",
            products: productsWithCompetitors,
        });

    } catch (error) {
        console.error("Error fetching latest products:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message || String(error),
        });
    }
};




// Save/update settings
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

// Get latest products based on saved category
export const getFeaturedProducts = async (req, res) => {
    try {
        const settings = await FeaturedSettings.findOne();
        const category = settings?.category || 'Winterreifen';
        const maxBrands = settings?.max_brands || 10;
        const competitorsPerProduct = settings?.competitors_per_product || 3;

        // 1. Fetch up to 1000 from category, sorted by popularity (average_rating DESC), then newest
        // Use an index on: {merchant_product_third_category:1, average_rating:-1, createdAt:-1, brand_name:1}
        const allProducts = await Product.find({
            merchant_product_third_category: {
                $regex: new RegExp(`^${category}$`, 'i')
            }
        })
            .sort({ average_rating: -1, createdAt: -1 }) // most popular, newest first
            .limit(1000)
            .select('brand_logo fuel_class product_image wet_grip noise_class dimensions merchant_product_third_category product_url product_name brand_name search_price merchant_product_category_path merchant_product_second_category average_rating review_count cheapest_offer expensive_offer savings_percent total_offers offers in_stock width height diameter speedIndex lastIndex product_category')
            .lean();

        // 2. Pick the most popular product per brand (first in sorted list)
        const uniqueBrandMap = new Map();
        for (const product of allProducts) {
            if (!uniqueBrandMap.has(product.brand_name)) {
                uniqueBrandMap.set(product.brand_name, product);
            }
        }
        const featuredProducts = Array.from(uniqueBrandMap.values()).slice(0, maxBrands);

        // 3. Build competitor facets for all featured products (as before)
        const competitorFacets = {};
        featuredProducts.forEach((product, idx) => {
            const facetName = `p${idx}`;
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
            competitorFacets[facetName] = [
                { $match: match },
                { $sort: { search_price: 1 } },
                {
                    $group: {
                        _id: "$brand_name",
                        doc: { $first: "$$ROOT" }
                    }
                },
                { $replaceRoot: { newRoot: "$doc" } },
                { $sort: { search_price: 1 } },
                { $limit: competitorsPerProduct },
                {
                    $project: {
                        _id: 1,
                        brand_name: 1,
                        product_name: 1,
                        product_url: 1,
                        search_price: 1,
                        average_rating: 1
                    }
                }
            ];
        });

        // 4. Facet aggregation for competitors
        const competitorAgg = await Product.aggregate([{ $facet: competitorFacets }]);
        const competitors = competitorAgg[0];

        // 5. Merge results with competitor fallback if less than N competitors
        const featuredWithCompetitors = await Promise.all(featuredProducts.map(async (product, idx) => {
            const facetName = `p${idx}`;
            let competitorsList = (competitors[facetName] || []).filter(r => String(r._id) !== String(product._id));
            if (competitorsList.length < competitorsPerProduct) {
                // Fallback: Broader match, ignore some fields
                const broadMatch = {
                    merchant_product_third_category: product.merchant_product_third_category,
                    product_category: product.product_category,
                    width: product.width,
                    diameter: product.diameter,
                    _id: { $ne: product._id }
                };
                Object.keys(broadMatch).forEach(k => (broadMatch[k] == null || broadMatch[k] === "") && delete broadMatch[k]);
                const broadCompetitors = await Product.find(broadMatch)
                    .sort({ search_price: 1 })
                    .select("_id brand_name product_name product_url search_price average_rating")
                    .lean();
                for (const c of broadCompetitors) {
                    if (
                        competitorsList.length < competitorsPerProduct &&
                        !competitorsList.some(r => String(r._id) === String(c._id))
                    ) {
                        competitorsList.push(c);
                    }
                }
            }
            return {
                ...product,
                related_cheaper: (competitorsList || []).slice(0, competitorsPerProduct).map(r => ({
                    _id: r._id,
                    brand_name: r.brand_name,
                    product_name: r.product_name,
                    url: r.product_url,
                    price: typeof r.search_price === "number"
                        ? r.search_price.toFixed(2).replace(".", ",")
                        : "0,00",
                    average_rating: r.average_rating
                }))
            };
        }));

        res.status(200).json({
            title: settings?.section_title || 'Our recommendation',
            category,
            products: featuredWithCompetitors
        });

    } catch (err) {
        console.error("⚠️ Featured product fetch error:", err);
        res.status(500).json({
            message: 'Error loading featured products',
            error: err.message
        });
    }
};


  
// export const GetFilterTyres = async (req, res) => {
//     try {
//         const { category, width, height, diameter } = req.query;

//         // Build the base match query
//         const baseQuery = {};
//         if (category) baseQuery.merchant_product_third_category = category;
//         if (width) baseQuery.width = width;
//         if (height) baseQuery.height = height;
//         if (diameter) baseQuery.diameter = diameter;
        
//         // Helper function to build aggregation pipeline for a field
//         const buildFacetPipeline = (fieldToGroup, removeFieldFromQuery) => {
//             const matchStage = { ...baseQuery };
//             delete matchStage[removeFieldFromQuery]; // Avoid filtering the same field we're grouping

//             return [
//                 { $match: matchStage },
//                 {
//                     $group: {
//                         _id: `$${fieldToGroup}`,
//                         count: { $sum: 1 },
//                     },
//                 },
//                 {
//                     $project: {
//                         name: '$_id',
//                         count: 1,
//                         _id: 0,
//                     },
//                 },
//                 {
//                     $sort: { count: -1 },
//                 },
//             ];
//         };

//         // Aggregate all 4 filters in parallel using $facet
//         const result = await Product.aggregate([
//             {
//                 $facet: {
//                     categories: buildFacetPipeline('merchant_product_third_category', 'merchant_product_third_category'),
//                     widths: buildFacetPipeline('width', 'width'),
//                     heights: buildFacetPipeline('height', 'height'),
//                     diameters: buildFacetPipeline('diameter', 'diameter'),
//                 },
//             },
//         ]);

//         const { categories, widths, heights, diameters } = result[0];

//         return res.status(200).json({
//             categories,
//             widths,
//             heights,
//             diameters,
//         });
//     } catch (err) {
//         console.error('Error in GetFilterTyres:', err);
//         return res.status(500).json({ message: 'Server error', error: err.message });
//     }
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