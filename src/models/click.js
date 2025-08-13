// models/click.js
import mongoose from "mongoose";

const clickSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", index: true },
    product_name: String,
    vendor: String,
    vendor_id: String,
    uuid: { type: String, index: true },
    source: String,           // e.g., 'search', 'home', 'email'
    clicked_at: { type: Date, default: Date.now, index: true },
}, { versionKey: false });

/** Helpful compound indexes */
clickSchema.index({ clicked_at: -1 });
clickSchema.index({ product_id: 1, clicked_at: -1 });
clickSchema.index({ uuid: 1, clicked_at: -1 });
clickSchema.index({ vendor: 1, clicked_at: -1 });

export default mongoose.models.Click || mongoose.model("Click", clickSchema, "clicks");
