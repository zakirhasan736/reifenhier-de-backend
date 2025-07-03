import mongoose from "mongoose";

const importMetaSchema = new mongoose.Schema({
    source: { type: String, required: true, unique: true }, // e.g. 'AWIN'
    lastSuccess: { type: Date, default: null }
});

export default mongoose.models.ImportMeta || mongoose.model("ImportMeta", importMetaSchema);
