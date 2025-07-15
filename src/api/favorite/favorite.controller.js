import Favorite from '../../models/favorite.js';
import Product from '../../models/product.js';

// Add to favorites
export async function addFavorite(req, res) {
    const uuid = req.cookies?.uuid || req.body.uuid;
    const { productId } = req.body;
    if (!uuid || !productId) return res.status(400).json({ error: 'Missing uuid or productId' });

    try {
        await Favorite.findOneAndUpdate(
            { uuid, productId },
            { $set: { uuid, productId } },
            { upsert: true, new: true }
        );
        // Analytics
        console.log(`[ANALYTICS] Favorite added`, { uuid, productId, date: new Date() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// Remove from favorites
export async function removeFavorite(req, res) {
    const uuid = req.cookies?.uuid || req.body.uuid;
    const { productId } = req.body;
    if (!uuid || !productId) return res.status(400).json({ error: 'Missing uuid or productId' });

    try {
        await Favorite.deleteOne({ uuid, productId });
        // Analytics
        console.log(`[ANALYTICS] Favorite removed`, { uuid, productId, date: new Date() });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// List all favorites for a user, return full product objects
export async function getFavorites(req, res) {
    const uuid = req.cookies?.uuid || req.query.uuid;
    if (!uuid) return res.status(400).json({ error: 'Missing uuid' });
    try {
        const favs = await Favorite.find({ uuid }).lean();
        const productIds = favs.map(f => f.productId);
        const products = await Product.find({ _id: { $in: productIds } }).lean();

        // Analytics
        console.log(`[ANALYTICS] Favorite list viewed`, { uuid, count: productIds.length, date: new Date() });

        // Preserve order
        const map = {};
        products.forEach(prod => { map[prod._id.toString()] = prod; });
        const ordered = productIds.map(id => map[id]).filter(Boolean);

        res.json({ favorites: ordered });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// Favorite count (for header)
export async function getFavoriteCount(req, res) {
    const uuid = req.cookies?.uuid || req.query.uuid;
    if (!uuid) return res.json({ count: 0 });
    try {
        const count = await Favorite.countDocuments({ uuid });
        res.json({ count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// Simple analytics endpoint: count unique visitors (UUIDs) with favorites in a time period
export async function getFavoriteStats(req, res) {
    const { from, to } = req.query;
    const match = {};
    if (from || to) {
        match.createdAt = {};
        if (from) match.createdAt.$gte = new Date(from);
        if (to) match.createdAt.$lte = new Date(to);
    }
    const results = await Favorite.aggregate([
        { $match: match },
        { $group: { _id: '$uuid', count: { $sum: 1 } } },
        { $count: 'uniqueVisitors' },
    ]);
    res.json({ uniqueVisitors: results[0]?.uniqueVisitors || 0 });
}
