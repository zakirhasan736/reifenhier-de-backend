import mongoose from 'mongoose';

// Define schema for wishlist items
const wishlistSchema = new mongoose.Schema(
    {
        uuid: { type: String, required: true, index: true }, // User identifier
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true }, // Product reference
        favoritedAt: { type: Date, default: Date.now }, // When the item was favorited
    },
    { timestamps: true } // Automatically adds createdAt and updatedAt
);

// Ensure uniqueness for uuid + productId
wishlistSchema.index({ uuid: 1, productId: 1 }, { unique: true });

export default mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);