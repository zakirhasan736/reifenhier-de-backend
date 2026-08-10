import mongoose from 'mongoose'

const pushSubscriptionSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, index: true },
    endpoint: { type: String, required: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    userAgent: String,
    enabled: { type: Boolean, default: true, index: true },
    welcomeSentAt: Date,
    lastCampaignAt: Date,
    lastCampaignKind: String,
    campaignsToday: { type: Number, default: 0 },
    campaignsDayKey: String, // YYYY-MM-DD UTC
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
)

pushSubscriptionSchema.index({ uuid: 1, endpoint: 1 }, { unique: true })
pushSubscriptionSchema.index({ endpoint: 1 }, { unique: true })

export default mongoose.models.PushSubscription ||
  mongoose.model('PushSubscription', pushSubscriptionSchema, 'push_subscriptions')
