import mongoose from 'mongoose'

/**
 * A sale/lead AWIN recorded for our publisher account.
 * Filled by the AWIN Transaction Notification webhook (near real-time)
 * and by the AWIN Publisher API poller (fallback + status updates).
 */
const awinTransactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    merchantId: String,
    merchantName: String,
    saleAmount: Number,
    commission: Number,
    currency: String,
    status: String, // pending | approved | declined | deleted
    clickRef: String, // our rx-<productId>-<source>
    clickRefs: mongoose.Schema.Types.Mixed,
    productId: String, // parsed from clickRef when possible
    transactionDate: Date,
    clickDate: Date,
    source: { type: String, enum: ['webhook', 'api'], default: 'api' },
    notifiedAt: Date,
    statusNotifiedAt: Date,
    raw: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
)

awinTransactionSchema.index({ transactionDate: -1 })

export default mongoose.models.AwinTransaction ||
  mongoose.model('AwinTransaction', awinTransactionSchema, 'awin_transactions')
