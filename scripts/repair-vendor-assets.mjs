/**
 * Backfill vendor_logo + payment_icons for offers (esp. reifen DE).
 * Usage: node scripts/repair-vendor-assets.mjs
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import { findLogo } from '../src/api/utils/logoFinder.js'
import { getVendorPaymentIcons } from '../src/api/utils/vendorPaymentIcons.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

// Ensure logo lookup uses backend root (src/images/...)
process.chdir(path.join(__dirname, '..'))

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)
const col = mongoose.connection.db.collection('products')

function enrichOffer(o = {}) {
  const plain = { ...o }
  const vendor = String(plain.vendor || '')
  const logo = findLogo('vendors', vendor) || String(plain.vendor_logo || '').trim()
  const existingIcons = Array.isArray(plain.payment_icons) ? plain.payment_icons : []
  const payment_icons =
    existingIcons.length > 0 ? existingIcons : getVendorPaymentIcons(vendor)

  return {
    ...plain,
    vendor_logo: logo,
    payment_icons,
  }
}

const cursor = col.find({}, { projection: { offers: 1, cheapest_vendor: 1 } })
let scanned = 0
let repaired = 0
let bulk = []

while (await cursor.hasNext()) {
  const doc = await cursor.next()
  scanned++

  const offers = Array.isArray(doc.offers) ? doc.offers : []
  const nextOffers = offers.map(enrichOffer)

  let cheapest = doc.cheapest_vendor ? enrichOffer(doc.cheapest_vendor) : null
  if (cheapest && nextOffers.length) {
    const match = nextOffers.find(
      (o) =>
        (cheapest.vendor_id && o.vendor_id === cheapest.vendor_id) ||
        (cheapest.vendor && o.vendor === cheapest.vendor)
    )
    if (match) {
      cheapest = {
        ...cheapest,
        vendor_logo: match.vendor_logo || cheapest.vendor_logo,
        payment_icons: match.payment_icons?.length
          ? match.payment_icons
          : cheapest.payment_icons,
      }
    }
  }

  const needsRepair = nextOffers.some((o, i) => {
    const prev = offers[i] || {}
    return (
      (o.vendor_logo || '') !== (prev.vendor_logo || '') ||
      JSON.stringify(o.payment_icons || []) !== JSON.stringify(prev.payment_icons || [])
    )
  })

  if (needsRepair || (cheapest && !doc.cheapest_vendor?.vendor_logo)) {
    bulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: {
          $set: {
            offers: nextOffers,
            ...(cheapest ? { cheapest_vendor: cheapest } : {}),
            ...(cheapest?.payment_icons
              ? { payment_methods: cheapest.payment_icons }
              : {}),
          },
        },
      },
    })
    repaired++
  }

  if (bulk.length >= 400) {
    await col.bulkWrite(bulk)
    bulk = []
    process.stdout.write(`\rRepaired ${repaired} / scanned ${scanned}`)
  }
}

if (bulk.length) await col.bulkWrite(bulk)
console.log(`\n✅ Scanned ${scanned}, repaired ${repaired} products with vendor logos/payments.`)
await mongoose.disconnect()
