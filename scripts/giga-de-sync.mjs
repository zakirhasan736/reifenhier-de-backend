#!/usr/bin/env node
/**
 * Put Giga Tyre on the German shop with euro prices from the AWIN feed.
 *
 * giga-reifen.de blocks this server (HTTP 403), so this does not open the
 * shop website. It downloads the German Giga product feed from AWIN and
 * writes that euro price and the giga-reifen.de link onto each matching tyre.
 *
 *   npm run giga:sync
 *   npm run giga:sync -- --dry-run
 *
 * The Swiss feed (giga-reifen.ch, CHF) is left unused.
 */
import path from 'path'
import { Readable } from 'stream'
import { fileURLToPath } from 'url'
import csv from 'csv-parser'
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import Product from '../src/models/product.js'
import affiliateCloak from '../src/api/utils/affiliateCloak.js'
import { computeOfferStats, getFeedProductKey, pickRowPrice } from '../src/api/utils/offerPricing.js'
import { isGigaVendor } from '../src/api/utils/gigaShop.js'
import { buildFeedUrl, parseFeedList, parseFeedUrl, unpackCsv } from '../src/api/utils/awinFeedDownload.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const DRY = process.argv.includes('--dry-run')

function feedHaystack(feed) {
  return Object.values(feed)
    .map((value) => String(value || ''))
    .filter((value) => value && value.length < 120 && !/https?:|apikey/i.test(value))
    .join(' ')
}

function feedLabel(feed) {
  const named = ['Feed Name', 'Advertiser Name', 'Language', 'Membership Status']
    .map((key) => feed[key])
    .filter((value) => value && !/https?:|apikey/i.test(String(value)))
  return named.join(' | ') || feedHaystack(feed).slice(0, 160)
}

function productCode(url) {
  const match = String(url || '').match(/\/product\/([A-Za-z0-9-]+)/i)
  return match ? match[1].toUpperCase() : ''
}

function shopHost(url) {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

async function feedList(origin, apikey) {
  const res = await fetch(`${origin}/datafeed/list/apikey/${apikey}`)
  if (!res.ok) throw new Error(`AWIN feed list HTTP ${res.status}`)
  return parseFeedList(await res.text())
}

async function downloadFeed(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`AWIN feed download HTTP ${res.status}`)
  return unpackCsv(Buffer.from(await res.arrayBuffer()))
}

function readRows(buffer) {
  return new Promise((resolve, reject) => {
    const rows = []
    Readable.from(buffer)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject)
  })
}

function indexGermanRows(rows) {
  const byKey = new Map()
  let german = 0
  let other = 0
  for (const row of rows) {
    const link = String(row.merchant_deep_link || '')
    const host = shopHost(link)
    if (!host.endsWith('giga-reifen.de')) {
      other++
      continue
    }
    const currency = String(row.currency || 'EUR').toUpperCase()
    if (currency && currency !== 'EUR') continue
    const price = pickRowPrice(row)
    if (!(price > 0)) continue
    german++
    const record = {
      price,
      link,
      aw: String(row.aw_deep_link || ''),
      awProductId: String(row.aw_product_id || ''),
      code: productCode(link),
    }
    const ean = getFeedProductKey(row)
    if (ean) byKey.set(`ean:${ean}`, record)
    if (record.code) byKey.set(`code:${record.code}`, record)
  }
  return { byKey, german, other }
}

await (async function main() {
  const feedUrl = process.env.AWIN_CSV_URL || ''
  const parsed = parseFeedUrl(feedUrl)
  const apikey = parsed?.params.get('apikey')
  if (!parsed || !apikey) {
    console.error('AWIN_CSV_URL is missing. No shop pages were requested.')
    process.exit(1)
  }

  console.log('Reading the AWIN feed list. The shop website is not contacted.')
  let list
  try {
    list = await feedList(parsed.origin, apikey)
  } catch (err) {
    console.error(err.message || err)
    console.error('Stopped. Nothing was written, and giga-reifen.de was not scraped.')
    process.exit(1)
  }

  const gigaFeeds = list.filter((feed) => /giga/i.test(feedHaystack(feed)))
  if (!gigaFeeds.length) {
    console.error('No Giga feed is visible on this AWIN account.')
    process.exit(1)
  }
  console.log('Giga feeds on the account:')
  for (const feed of gigaFeeds) {
    console.log(`- ${feed['Feed ID']}: ${feedLabel(feed)}`)
  }

  const preferred = [...gigaFeeds].sort((a, b) => {
    const score = (feed) => {
      const text = feedHaystack(feed).toLowerCase()
      if (/giga-reifen\.de|deutschland/.test(text)) return 3
      if (/\bde\b/.test(text) && !/\bch\b|schweiz|\.ch|chde/.test(text)) return 2
      if (/\bch\b|schweiz|\.ch|chde/.test(text)) return 0
      return 1
    }
    return score(b) - score(a)
  })

  let indexed = null
  let used = null
  for (const feed of preferred) {
    const fid = String(feed['Feed ID'])
    console.log(`Downloading feed ${fid}…`)
    const buffer = await downloadFeed(buildFeedUrl(parsed, { fid }))
    const rows = await readRows(buffer)
    const result = indexGermanRows(rows)
    console.log(`Feed ${fid}: ${result.german} German rows, ${result.other} other shop rows.`)
    if (result.german > 0) {
      indexed = result
      used = feed
      break
    }
  }

  if (!indexed) {
    console.error('None of the Giga feeds contain www.giga-reifen.de links.')
    console.error('In AWIN, join the giga-reifen.de product feed, then run npm run giga:sync again.')
    process.exit(2)
  }

  console.log(`Using feed ${used['Feed ID']} (${feedLabel(used)}).`)
  await mongoose.connect(process.env.MONGODB_URI)
  const products = await Product.find({ 'offers.vendor': /giga/i })
    .select({ product_name: 1, ean: 1, offers: 1, import_hash: 1 })
    .lean()

  let matched = 0
  let saved = 0
  let missed = 0
  const samples = []

  for (const product of products) {
    const ean = getFeedProductKey({ ean: product.ean })
    let changed = false
    for (const offer of product.offers || []) {
      if (!isGigaVendor(offer)) continue
      const code = productCode(offer.merchant_deep_link)
      const row = (ean && indexed.byKey.get(`ean:${ean}`)) || (code && indexed.byKey.get(`code:${code}`))
      if (!row) {
        missed++
        continue
      }
      matched++
      if (samples.length < 5) {
        samples.push({ name: product.product_name, before: offer.price, price: row.price, link: row.link })
      }
      if (DRY) continue
      const before = Number(offer.price) || 0
      if (!(Number(offer.awin_price) > 0)) offer.awin_price = before
      offer.price = row.price
      offer.currency = 'EUR'
      offer.merchant_deep_link = row.link
      offer.price_source = 'awin'
      offer.merchant_price = row.price
      offer.merchant_price_checked_at = new Date()
      offer.price_mismatch = false
      if (row.awProductId) offer.aw_product_id = row.awProductId
      if (/awin1\.com/i.test(row.aw)) {
        offer.original_affiliate_url = row.aw
        offer.affiliate_product_cloak_url = affiliateCloak.encodeAffiliateUrl(row.aw)
        offer.aw_deep_link = `/go/${row.awProductId || offer.aw_product_id}?from=reifendb`
      }
      changed = true
    }
    if (!changed || DRY) continue
    const derived = computeOfferStats(product.offers)
    const res = await Product.updateOne(
      { _id: product._id, import_hash: product.import_hash ?? null },
      { $set: { offers: product.offers, ...derived, last_price_refreshed_at: new Date() } }
    )
    if (res.matchedCount) saved++
  }

  console.log(`Matched ${matched} Giga offers to the German feed. Products saved: ${saved}. No German row: ${missed}.${DRY ? ' Dry-run, nothing written.' : ''}`)
  for (const row of samples) {
    console.log(`- ${row.name}: ${row.before} CHF → ${row.price} EUR`)
    console.log(`  ${row.link}`)
  }
  await mongoose.disconnect()
})().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})
