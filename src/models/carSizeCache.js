import mongoose from 'mongoose'

/** AI answers for "car → tyre sizes", so each car is asked only once (free + consistent). */
const carSizeCacheSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true }, // "vw|golf 7|2016"
    generation: String,
    sizes: [{ _id: false, width: String, height: String, diameter: String, loadIndex: String, speedIndex: String }],
    source: String,
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
  },
  { versionKey: false }
)

export default mongoose.models.CarSizeCache || mongoose.model('CarSizeCache', carSizeCacheSchema, 'car_size_cache')
