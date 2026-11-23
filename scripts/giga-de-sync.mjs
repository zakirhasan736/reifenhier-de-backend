#!/usr/bin/env node
/**
 * Giga Tyre prices from the German shop.
 *
 * The AWIN feed we have is the Swiss shop (giga-reifen.ch, prices in CHF).
 * Visitors on reifexa.de must see the euro price and open:
 *
 *   https://www.giga-reifen.de/product/<id>
 *
 * A stored Swiss link is rewritten to that URL. Only a euro price from the
 * German page is saved. A franc amount is never written as euros.
 *
 *   node scripts/giga-de-sync.mjs                 # clicked tyres first, then the rest
 *   node scripts/giga-de-sync.mjs --limit 30
 *   node scripts/giga-de-sync.mjs --dry-run
 *   node scripts/giga-de-sync.mjs --probe         # one clicked tyre, write nothing
 *
 * npm run giga:sync
 */
import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import axios from 'axios'
import Product from '../src/models/product.js'
import { germanGigaUrl, isGigaVendor } from '../src/api/utils/gigaShop.js'
import { mainProductPrice } from '../src/api/utils/refreshPricesFromMerchants.js'
import { computeOfferStats } from '../src/api/utils/offerPricing.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const args = process.argv.slice(2)
const has = (flag) => args.includes(flag)
const DRY = has('--dry-run') || has('--probe')
const limitArg = args.find((arg, i) => args[i - 1] === '--limit')
const LIMIT = has('--probe') ? 1 : Math.max(0, Number(limitArg) || 0)

const SHOP = 'https://www.giga-reifen.de'

async function readEuroPrice(url) {
  try {
    const { data, status } = await axios.get(url, {
      timeout: 15000,
      maxRedirects: 5,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      validateStatus: (status) => status >= 200 && status < 400,
    })
    if (typeof data !== 'string') return { status, price: 0 }
    return { status, price: mainProductPrice(data) || 0 }
  } catch (err) {
    return { status: err?.response?.status || 0, price: 0 }
  }
}

await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const since = new Date(Date.now() - 14 * 86400000)
const clickedIds = await db.collection('clicks').distinct('product_id', {
  vendor: /giga/i,
  clicked_at: { $gte: since },
  product_id: { $type: 'objectId' },
})

const products = await Product.find({ 'offers.vendor': /giga/i })
  .select({ product_name: 1, offers: 1, import_hash: 1 })
  .lean()

products.sort((a, b) => Number(clickedIds.some((id) => String(id) === String(b._id))) - Number(clickedIds.some((id) => String(id) === String(a._id))))

const queue = LIMIT ? products.slice(0, LIMIT) : products
console.log(`German shop: ${SHOP}`)
console.log(`Giga products: ${products.length}. Clicked in 14 days: ${clickedIds.length}. This run: ${queue.length}${DRY ? ' (dry-run)' : ''}`)

let updated = 0
let priced = 0
let failed = 0
const samples = []

for (const product of queue) {
  let changed = false
  for (const offer of product.offers || []) {
    if (!isGigaVendor(offer)) continue
    const nextUrl = germanGigaUrl(offer.merchant_deep_link)
    if (!nextUrl) {
      failed++
      continue
    }
    const { status, price } = await readEuroPrice(nextUrl)
    if (!(price > 0)) {
      failed++
      if (samples.length < 5) samples.push({ name: product.product_name, url: nextUrl, status, price: null })
      continue
    }
    priced++
    const before = Number(offer.price) || 0
    if (samples.length < 5) samples.push({ name: product.product_name, url: nextUrl, status, before, price, currency: 'EUR' })
    if (offer.merchant_deep_link !== nextUrl || Math.abs(before - price) >= 0.01 || String(offer.currency).toUpperCase() !== 'EUR') {
      changed = true
    }
    if (!DRY) {
      if (!(Number(offer.awin_price) > 0)) offer.awin_price = before
      offer.merchant_deep_link = nextUrl
      offer.price = price
      offer.currency = 'EUR'
      offer.price_source = 'merchant-live'
      offer.merchant_price = price
      offer.merchant_price_checked_at = new Date()
      offer.price_mismatch = false
    }
  }
  if (!changed || DRY) continue
  const derived = computeOfferStats(product.offers)
  const res = await Product.updateOne(
    { _id: product._id, import_hash: product.import_hash ?? null },
    { $set: { offers: product.offers, ...derived, last_price_refreshed_at: new Date() } }
  )
  if (res.matchedCount) updated++
}

console.log(`Euro prices read: ${priced}. Pages without a euro price: ${failed}. Products saved: ${updated}.`)
for (const row of samples) {
  console.log(`- ${row.name}`)
  console.log(`  ${row.url}`)
  console.log(`  page ${row.status}  ${row.before != null ? `${row.before} → ` : ''}${row.price ?? 'no euro price'}`)
}

await mongoose.disconnect()
