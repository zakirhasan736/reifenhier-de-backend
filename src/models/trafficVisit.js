import mongoose from 'mongoose'

/**
 * One row per visit (first page of a browser session) – where the visitor came from.
 * Cookieless and anonymous: no IP, no user id. Auto-deleted after 13 months.
 */
const trafficVisitSchema = new mongoose.Schema(
  {
    channel: { type: String, index: true }, // ai | search | social | email | paid | referral | direct
    source: { type: String, index: true }, // ChatGPT, Google, …
    referrerHost: String,
    utmSource: String,
    utmMedium: String,
    utmCampaign: String,
    landingPath: String,
    productSlug: { type: String, index: true },
    device: String, // mobile | desktop | tablet
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 },
  },
  { versionKey: false }
)
trafficVisitSchema.index({ createdAt: -1, channel: 1 })

export default mongoose.models.TrafficVisit || mongoose.model('TrafficVisit', trafficVisitSchema, 'traffic_visits')
