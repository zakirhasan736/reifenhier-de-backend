// src/models/importMeta.js
import mongoose from "mongoose";

const ImportMetaSchema = new mongoose.Schema({
    source: { type: String, required: true },
    isRunning: { type: Boolean, default: false },
    done: { type: Boolean, default: false },
    imported: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    lastStarted: { type: Date },
    lastSuccess: { type: Date },
    progress: { type: Number, default: 0 },
    deleted: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    lastError: { type: String },
    lastErrorAt: { type: Date },
    // per-run vendor coverage, see importAWINCsv
    stats: { type: mongoose.Schema.Types.Mixed },
});

export default mongoose.model("ImportMeta", ImportMetaSchema);

