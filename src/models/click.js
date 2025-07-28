import mongoose from "mongoose";

const clickSchema = new mongoose.Schema({
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    product_name: String,
    vendor: String,
    vendor_id: String,
    uuid: String,
    source: String,
    clicked_at: { type: Date, default: Date.now }
});

export default mongoose.model("Click", clickSchema, "clicks");
