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
            index: true,
        },
    },
    { versionKey: false }
);

/* Performance */
pageViewSchema.index({ viewed_at: -1 });
pageViewSchema.index({ uuid: 1, viewed_at: -1 });
pageViewSchema.index({ page: 1 });

/* GDPR cleanup — auto delete after 90 days */
pageViewSchema.index(
    { viewed_at: 1 },
    { expireAfterSeconds: 60 * 60 * 24 * 90 }
);

export default mongoose.models.PageView ||
    mongoose.model("PageView", pageViewSchema, "page_views");
