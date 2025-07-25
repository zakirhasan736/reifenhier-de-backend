import Wishlist from '../../models/wishlist.js';
import Product from '../../models/product.js';

// Add to wishlist
export async function addWishlist(req, res) {
    const uuid = req.cookies?.uuid || req.body.uuid;
    const { productId } = req.body;
    if (!uuid || !productId) return res.status(400).json({ error: 'Missing uuid or productId' });

    try {
        await Wishlist.findOneAndUpdate(
            { uuid, productId },
            { $set: { uuid, productId, favoritedAt: new Date() } },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// Remove from wishlist
export async function removeWishlist(req, res) {
    const uuid = req.cookies?.uuid || req.body.uuid;
    const { productId } = req.body;
    if (!uuid || !productId) return res.status(400).json({ error: 'Missing uuid or productId' });

    try {
        await Wishlist.deleteOne({ uuid, productId });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// List wishlist items for the user
export async function getWishlist(req, res) {
    const uuid = req.cookies?.uuid || req.query.uuid;
    if (!uuid) return res.status(400).json({ error: 'Missing uuid' });

    try {
        const entries = await Wishlist.find({ uuid }).lean();
        const productIds = entries.map(e => e.productId);

        const products = await Product.find({ _id: { $in: productIds } }).lean();
        const map = {};
        products.forEach(prod => {
            map[prod._id.toString()] = prod;
        });

        const ordered = entries
            .map(entry => ({ ...map[entry.productId.toString()], favoritedAt: entry.favoritedAt }))
            .filter(Boolean);

        res.json({ wishlist: ordered });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// Get count of wishlist items
export async function getWishlistCount(req, res) {
    const uuid = req.cookies?.uuid || req.query.uuid;
    if (!uuid) return res.json({ count: 0 });

    try {
        const count = await Wishlist.countDocuments({ uuid });
        res.json({ count });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}