// Compare stored reifen.com offer prices with the live reifen.com product page.
// Read-only: never writes to the database.
//
// Usage (from the backend folder on the server):
//   node scripts/check-reifen-com-prices.mjs            # 30 random products
//   node scripts/check-reifen-com-prices.mjs 100        # 100 random products
//   node scripts/check-reifen-com-prices.mjs <slug>     # one product by slug
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import axios from 'axios'
import { mainProductPrice } from '../src/api/utils/refreshPricesFromMerchants.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const arg = process.argv[2] || '30'
const isSlug = !/^\d+$/.test(arg)
const VENDOR = /^\s*reifen\.com\s*$/i
const TOLERANCE = 0.01 // 1 cent

async function fetchHtml(url) {
  try {
    const { data, status } = await axios.get(url, {
      timeout: 20000,
      maxRedirects: 5,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'de-DE,de;q=0.9',
      },
      validateStatus: () => true,
    })
    return { html: typeof data === 'string' ? data : '', status }
  } catch (e) {
    return { html: '', status: e.code || 'ERR' }
  }
}

await mongoose.connect(process.env.MONGODB_URI)
const col = mongoose.connection.db.collection('products')

const match = isSlug
  ? { slug: arg }
  : { offers: { $elemMatch: { vendor: VENDOR, price: { $gt: 0 } } } }
const pipeline = [{ $match: match }]
if (!isSlug) pipeline.push({ $sample: { size: Number(arg) } })
pipeline.push({ $project: { slug: 1, ean: 1, product_name: 1, offers: 1, last_price_synced_at: 1, updatedAt: 1 } })
const products = await col.aggregate(pipeline).toArray()

const totals = { checked: 0, same: 0, wrong: 0, unreadable: 0, noOffer: 0 }
const wrong = []

for (const p of products) {
  const offer = (p.offers || []).find((o) => VENDOR.test(o.vendor || ''))
  if (!offer) { totals.noOffer++; continue }
  const url = String(offer.merchant_deep_link || '').trim()
  if (!/^https?:\/\//i.test(url)) { totals.unreadable++; continue }

  const { html, status } = await fetchHtml(url)
  const live = html ? mainProductPrice(html) : undefined
  totals.checked++
  if (!(live > 0)) {
    totals.unreadable++
    console.log(`?  ${p.ean}  stored ${offer.price}  live: unreadable (HTTP ${status})  ${url}`)
    continue
  }
  const diff = +(live - Number(offer.price)).toFixed(2)
  if (Math.abs(diff) <= TOLERANCE) {
    totals.same++
    console.log(`OK ${p.ean}  stored ${offer.price}  live ${live}`)
  } else {
    totals.wrong++
    const row = { ean: p.ean, slug: p.slug, name: p.product_name, stored: offer.price, live, diff, url,
      aw_product_id: offer.aw_product_id, synced: p.last_price_synced_at || p.updatedAt }
    wrong.push(row)
    console.log(`XX ${p.ean}  stored ${offer.price}  live ${live}  (diff ${diff > 0 ? '+' : ''}${diff})  ${p.slug}`)
  }
  await new Promise((r) => setTimeout(r, 500)) // be polite to reifen.com
}

console.log('\n==== Summary ====')
console.log(totals)
if (wrong.length) {
  const pct = ((wrong.length / Math.max(1, totals.checked - totals.unreadable)) * 100).toFixed(0)
  console.log(`\n${wrong.length} reifen.com prices differ from the live page (${pct}% of readable checks):`)
  console.table(wrong.map(({ ean, stored, live, diff, synced }) => ({ ean, stored, live, diff, synced })))
} else if (totals.checked - totals.unreadable > 0) {
  console.log('\nAll readable reifen.com prices match the live page.')
}
if (totals.unreadable && totals.unreadable === totals.checked) {
  console.log('\nNo live prices could be read — reifen.com may be blocking the server or its page format changed.')
}
await mongoose.disconnect()
