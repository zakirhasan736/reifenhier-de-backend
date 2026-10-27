import mongoose from "mongoose";

/**
 * One price per product, shop and day (the last price seen that day).
 * vendor_key "__best__" holds the product's best (cheapest in-stock) price.
 * Written only when a product's feed data changes, so a missing day means
 * "same price as the previous point".
 */
const PriceHistorySchema = new mongoose.Schema(
    {
        ean: { type: String, required: true },
        vendor_key: { type: String, required: true }, // vendor_id, vendor name, or "__best__"
        vendor: String,
        day: { type: String, required: true }, // YYYY-MM-DD (Europe/Berlin)
        price: Number,
        in_stock: Boolean,
        at: { type: Date, default: Date.now },
    },
    { versionKey: false }
);

PriceHistorySchema.index({ ean: 1, vendor_key: 1, day: 1 }, { unique: true });
// keep ~13 months
PriceHistorySchema.index({ at: 1 }, { expireAfterSeconds: 400 * 24 * 3600 });

export default mongoose.models.PriceHistory || mongoose.model("PriceHistory", PriceHistorySchema);
