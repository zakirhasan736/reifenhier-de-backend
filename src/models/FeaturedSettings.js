// models/FeaturedSettings.js
import mongoose from 'mongoose';

const FeaturedSettingsSchema = new mongoose.Schema(
    {
        section_title: { type: String, required: true },
        category: { type: String, required: true },

        // ⭐ NEW: Recommendation Mode
        mode: {
            type: String,
            enum: ["default", "custom"],
            default: "default",
        },

        // ⭐ NEW: Custom selected products
        selected_products: [
            { type: mongoose.Schema.Types.ObjectId, ref: "Product" }
        ],

        max_brands: { type: Number, default: 10 },
        competitors_per_product: { type: Number, default: 3 },
    },
    { timestamps: true }
);

export default mongoose.models.FeaturedSettings ||
    mongoose.model("FeaturedSettings", FeaturedSettingsSchema);
