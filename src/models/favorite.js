import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema({
    uuid: { type: String, required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Product' },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: true })

// Prevent duplicate favorites for the same user
favoriteSchema.index({ uuid: 1, productId: 1 }, { unique: true });

export default mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);
