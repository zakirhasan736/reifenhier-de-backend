import mongoose from 'mongoose'

/**
 * Owner / admin devices that receive business alerts (AWIN sales, click-outs).
 * Kept separate from customer push_subscriptions so price-alert campaigns
 * never reach the owner and sales alerts never reach customers.
 */
const adminPushSubscriptionSchema = new mongoose.Schema(
  {
    endpoint: { type: String, required: true, unique: true },
    keys: {
      p256dh: { type: String, required: true },
      auth: { type: String, required: true },
    },
    label: { type: String, default: '' }, // e.g. "MacBook Chrome"
    userAgent: String,
    // Which alerts this device wants
    notifySales: { type: Boolean, default: true },
    notifyClicks: { type: Boolean, default: true },
    enabled: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
)

export default mongoose.models.AdminPushSubscription ||
  mongoose.model(
    'AdminPushSubscription',
    adminPushSubscriptionSchema,
    'admin_push_subscriptions'
  )
