import mongoose from 'mongoose'

/** Tracks marketing/digest pushes so we don't spam the same campaign. */
const pushCampaignLogSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, index: true },
    kind: {
      type: String,
      required: true,
      index: true,
      // welcome | season | new_brand | popular | best_deal | better_vendor | digest
    },
    title: String,
    body: String,
    url: String,
    meta: { type: mongoose.Schema.Types.Mixed },
    sentAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  },
  { versionKey: false }
)

pushCampaignLogSchema.index({ uuid: 1, kind: 1, sentAt: -1 })

export default mongoose.models.PushCampaignLog ||
  mongoose.model('PushCampaignLog', pushCampaignLogSchema, 'push_campaign_logs')
