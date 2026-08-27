import mongoose from 'mongoose'

const behaviorSchema = new mongoose.Schema(
  {
    uuid: { type: String, index: true },
    type: {
      type: String,
      index: true,
      // visit | click | vendor_exit | filter | compare | scroll | cta_impression | other
    },
    page: String,
    action: String, // e.g. open_vendor, apply_filter, add_compare
    instruction: String, // human CTA / UI label
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      index: true,
    },
    vendor: String,
    vendor_id: String,
    meta: { type: mongoose.Schema.Types.Mixed },

    // device + geo (same shape as clicks / page_views)
    country: String,
    city: String,
    ip: String,
    user_agent: String,
    device_type: String,
    browser: String,
    os: String,

    created_at: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 90, // GDPR: auto-delete after 90 days
    },
  },
  { versionKey: false }
)

behaviorSchema.index({ uuid: 1, created_at: -1 })
behaviorSchema.index({ type: 1, created_at: -1 })

export default mongoose.models.Behavior ||
  mongoose.model('Behavior', behaviorSchema, 'behaviors')
