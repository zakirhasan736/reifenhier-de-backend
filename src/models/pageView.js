import mongoose from "mongoose";

const pageViewSchema = new mongoose.Schema(
    {
        uuid: { type: String, index: true }, // anonymous user id
        page: String,                        // e.g. "/produkte/abc"
        source: String,                      // landing, product, listing

        // GEO
        country: String,
        city: String,

        // Privacy-safe IP
        ip: String,

        // Device
        device_type: String,                 // mobile | desktop | tablet
        browser: String,
        os: String,
        user_agent: String,

        viewed_at: {
            type: Date,
            default: Date.now,
            expires: 60 * 60 * 24 * 90, // GDPR: auto-delete after 90 days
        },
    },
    { versionKey: false }
);

/* Performance (TTL on viewed_at also covers date sorts) */
pageViewSchema.index({ uuid: 1, viewed_at: -1 });
pageViewSchema.index({ page: 1 });

export default mongoose.models.PageView ||
    mongoose.model("PageView", pageViewSchema, "page_views");
