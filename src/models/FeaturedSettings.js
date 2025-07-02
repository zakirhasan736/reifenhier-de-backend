// models/FeaturedSettings.js
import mongoose from 'mongoose';

const FeaturedSettingsSchema = new mongoose.Schema({
    section_title: { type: String, required: true },
    category: { type: String, required: true },
}, { timestamps: true });

export default mongoose.models.FeaturedSettings ||
    mongoose.model('FeaturedSettings', FeaturedSettingsSchema);
