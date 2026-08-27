// models/click.js
import mongoose from "mongoose";

const clickSchema = new mongoose.Schema(
    {
        product_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Product",
            index: true,
        },

        product_name: String,

        vendor: String,
        vendor_id: String,

        brand_name: String,           // NEW — track brand clicks
        brand_id: String,

        clickref: String,
        campaign_id: String,
        awin_affiliate_id: String,
        awin_merchant_id: String,

        uuid: { type: String, index: true },
        source: String,               // e.g., “produktseite”, “vergleich”, “listing”

        // CTA / behavior context
        instruction: String,          // button label / CTA name e.g. "Zum Angebot"
        behavior: String,             // e.g. vendor_exit | compare | filter
        referrer: String,

        // 🌍 GEO information
        country: String,              // e.g., "DE"
        city: String,
        ip: String,

        // 📱 Device tracking
        user_agent: String,           // raw user-agent string
        device_type: String,          // "mobile" | "desktop" | "tablet"
        browser: String,              // e.g., Chrome, Safari, Firefox
        os: String,                   // Windows, iOS, Android, macOS

        clicked_at: {
            type: Date,
            default: Date.now,
            expires: 60 * 60 * 24 * 90, // GDPR: auto-delete after 90 days
        },
    },
    { versionKey: false }
);

/** Indexes for faster analytics (TTL on clicked_at also covers date sorts) */
clickSchema.index({ product_id: 1, clicked_at: -1 });
clickSchema.index({ vendor: 1, clicked_at: -1 });
clickSchema.index({ brand_name: 1 });
clickSchema.index({ country: 1 });
clickSchema.index({ device_type: 1 });
clickSchema.index({ behavior: 1, clicked_at: -1 });
clickSchema.index({ instruction: 1 });
export default mongoose.models.Click ||
    mongoose.model("Click", clickSchema, "clicks");
