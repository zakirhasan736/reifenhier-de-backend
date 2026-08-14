import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { findLogo } from '../src/api/utils/logoFinder.js'
import { getVendorPaymentIcons } from '../src/api/utils/vendorPaymentIcons.js'

dotenv.config()
await mongoose.connect(process.env.MONGODB_URI)
const col = mongoose.connection.db.collection('products')
const p = await col.findOne({ 'offers.vendor': 'reifen DE' })
console.log('sample offer keys', Object.keys(p.offers.find((o) => o.vendor === 'reifen DE') || {}))

const offers = p.offers.map((o) => {
  if (o.vendor !== 'reifen DE') return o
  const logo = findLogo('vendors', o.vendor)
  const icons = getVendorPaymentIcons(o.vendor)
  console.log('computed', logo, icons.length)
  return { ...o, vendor_logo: logo, payment_icons: icons }
})

const r = await col.updateOne({ _id: p._id }, { $set: { offers } })
console.log('modified', r.modifiedCount)

const again = await col.findOne({ _id: p._id }, { projection: { offers: 1 } })
const rd = again.offers.find((o) => o.vendor === 'reifen DE')
console.log('after', rd.vendor_logo, rd.payment_icons)

// Check schema path
import Product from '../src/models/product.js'
const paths = Object.keys(Product.schema.paths).filter((k) => k.includes('offer') || k.includes('payment') || k.includes('vendor'))
console.log('schema paths sample', paths.slice(0, 30))
console.log('offers schema', Product.schema.path('offers'))

await mongoose.disconnect()
