import mongoose from 'mongoose'

const vendorPriceSchema = new mongoose.Schema(
  {
    vendor: String,
    vendor_id: String,
    price: Number,
  },
  { _id: false }
)

/**
 * Durable product interest for push price alerts.
 * Sources: view | vendor_click | purchase_intent | wishlist
 */
const productInterestSchema = new mongoose.Schema(
  {
    uuid: { type: String, required: true, index: true },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    slug: String,
    productName: String,
    brandName: String,
    dimensions: String,

    /** Last known cheapest / search price we compared against */
    lastPrice: { type: Number, default: null },
    /** Snapshot of offer prices by vendor */
    lastVendorPrices: { type: [vendorPriceSchema], default: [] },
    lastOfferCount: { type: Number, default: 0 },

    /** Vendor the user clicked / intended to buy from */
    preferredVendor: String,
    preferredVendorId: String,
    preferredVendorLastPrice: { type: Number, default: null },

    sources: {
      type: [String],
      default: [],
    },

    notifyEnabled: { type: Boolean, default: true, index: true },
    lastNotifiedAt: Date,
    lastNotifiedKind: String,

    viewedAt: Date,
    clickedAt: Date,
    purchaseIntentAt: Date,
  },
  { timestamps: true, versionKey: false }
)

productInterestSchema.index({ uuid: 1, productId: 1 }, { unique: true })
productInterestSchema.index({ notifyEnabled: 1, updatedAt: -1 })
productInterestSchema.index({ productId: 1, notifyEnabled: 1 })

export default mongoose.models.ProductInterest ||
  mongoose.model('ProductInterest', productInterestSchema, 'product_interests')
