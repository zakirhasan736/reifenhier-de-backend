import Product from '../../models/product.js';

export const buildQueryFromFilters = (filters = {}) => {
    const query = {};

    if (filters.category) query.merchant_product_third_category = filters.category;
    if (filters.brand) query.brand_name = filters.brand;
    if (filters.width) query.width = filters.width;
    if (filters.height) query.height = filters.height;
    if (filters.diameter) query.diameter = filters.diameter;
    if (filters.speedIndex) query.speedIndex = filters.speedIndex;
    if (filters.lastIndex) query.lastIndex = filters.lastIndex;
    if (filters.noise) query.noise_class = filters.noise;
    if (filters.fuelClass) query.fuel_class = filters.fuelClass;
    if (filters.wetGrip) query.wet_grip = filters.wetGrip;

    // ✅ Add this for price filtering:
    if (filters.minPrice || filters.maxPrice) {
        const min = parseFloat(filters.minPrice) || 0;
        const max = parseFloat(filters.maxPrice) || Number.MAX_VALUE;
        query.search_price = { $gte: min, $lte: max };
    }

    return query;
};
  

// --- Price Range Utility ---
export const getPriceRange = async (query) => {
    const prices = await Product.find(query).select('search_price');
    const validPrices = prices
        .map(p => parseFloat(p.search_price))
        .filter(p => !isNaN(p));
    const min = validPrices.length ? Math.min(...validPrices) : 0;
    const max = validPrices.length ? Math.max(...validPrices) : 0;
    return { minPrices: min, maxPrices: max };
};

// --- Generic Count Helper ---
const countByField = async (field, query) => {
    const q = { ...query };
    delete q[field];
    const docs = await Product.find(q, field);
    const counts = {};
    docs.forEach(doc => {
        const val = doc[field] || 'Unknown';
        counts[val] = (counts[val] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
};

// --- Export Field-Specific Count Getters ---
export const getCategoryCounts = async (query) => countByField('merchant_product_third_category', query);
export const getBrandCounts = async (query) => countByField('brand_name', query);
export const getWidthCounts = async (query) => countByField('width', query);
export const getHeightCounts = async (query) => countByField('height', query);
export const getDiameterCounts = async (query) => countByField('diameter', query);
export const getSpeedIndexCounts = async (query) => countByField('speedIndex', query);
export const getLastIndexCounts = async (query) => countByField('lastIndex', query);
export const getNoiseCounts = async (query) => countByField('noise_class', query);
export const getFuelClassCounts = async (query) => countByField('fuel_class', query);
export const getWetGripCounts = async (query) => countByField('wet_grip', query);
