#!/usr/bin/env node
/**
 * Remove one shop's offers from all products (e.g. Giga Tyres EU while its
 * feed is paused) and recompute best price / offer count. Other shops untouched.
 *
 *   node scripts/remove-vendor-offers.mjs --vendor-id 9352 --dry-run   # count only
 *   node scripts/remove-vendor-offers.mjs --vendor-id 9352             # remove
 *
 * Also remove the shop's feed id from AWIN_CSV_URL (or uncheck it in AWIN),
 * otherwise the next import brings the offers back.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import Product from '../src/models/product.js'
import { computeOfferStats } from '../src/api/utils/offerPricing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const args = process.argv.slice(2)
const vendorId = String(args[args.indexOf('--vendor-id') + 1] || '')
const DRY = args.includes('--dry-run')
if (!args.includes('--vendor-id') || !/^\d+$/.test(vendorId)) {
  console.error('Usage: node scripts/remove-vendor-offers.mjs --vendor-id <AWIN merchant id> [--dry-run]')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)
const ids = [vendorId, Number(vendorId)]
const products = await Product.find({ 'offers.vendor_id': { $in: ids } }).select({ offers: 1, product_name: 1 }).lean()
let offers = 0
let emptied = 0
let saved = 0
for (const p of products) {
  const keep = (p.offers || []).filter((o) => !ids.includes(o.vendor_id))
  offers += (p.offers || []).length - keep.length
  if (!keep.length) emptied++
  if (DRY) continue
  const r = await Product.updateOne({ _id: p._id }, { $set: { offers: keep, ...computeOfferStats(keep) } })
  if (r.modifiedCount) saved++
}
console.log(
  `${DRY ? '[dry-run] ' : ''}Shop ${vendorId}: ${offers} offers in ${products.length} products` +
    (DRY ? ' would be removed' : ` removed (${saved} products updated)`) +
    `. Products that had only this shop: ${emptied} (no other offer to show for them).`
)
await mongoose.disconnect()
