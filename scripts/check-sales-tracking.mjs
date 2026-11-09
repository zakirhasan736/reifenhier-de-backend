/**
 * Read-only health check for click and sale tracking. Changes nothing.
 *
 *   node scripts/check-sales-tracking.mjs
 *
 * Shows:
 *   1. "Zum Angebot" clicks per day (last 7 days) and how many carry a clickref
 *   2. AWIN sales stored per day (last 14 days) and the newest one
 *   3. What AWIN's API reports for the last 3 days right now (if AWIN_API_TOKEN is set)
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '—')
const since = (days) => new Date(Date.now() - days * 86400000)

// 1. Clicks
console.log('\n=== 1. Shop clicks (last 7 days, UTC) ===')
const clicks = await db.collection('clicks').aggregate([
  { $match: { clicked_at: { $gte: since(7) } } },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$clicked_at' } },
      clicks: { $sum: 1 },
      withClickref: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$clickref', ''] } }, 0] }, 1, 0] } },
    },
  },
  { $sort: { _id: 1 } },
]).toArray()
if (!clicks.length) console.log('No clicks logged in 7 days  ← problem: clickouts are not reaching the backend')
for (const c of clicks) console.log(`${c._id}   clicks: ${String(c.clicks).padStart(5)}   with clickref: ${c.withClickref}`)
const lastClick = await db.collection('clicks').find({}, { projection: { clicked_at: 1, vendor: 1, clickref: 1 } }).sort({ clicked_at: -1 }).limit(1).next()
console.log(`Newest click: ${lastClick ? `${new Date(lastClick.clicked_at).toISOString()}  ${lastClick.vendor || ''}  ${lastClick.clickref || '(no clickref)'}` : '—'}`)

// 2. Stored sales
console.log('\n=== 2. AWIN sales stored (last 14 days, by sale date) ===')
const tx = await db.collection('awin_transactions').aggregate([
  { $match: { transactionDate: { $gte: since(14) } } },
  {
    $group: {
      _id: { $dateToString: { format: '%Y-%m-%d', date: '$transactionDate' } },
      sales: { $sum: 1 },
      commission: { $sum: { $ifNull: ['$commission', 0] } },
    },
  },
  { $sort: { _id: 1 } },
]).toArray()
if (!tx.length) console.log('No sales stored with a sale date in the last 14 days')
for (const t of tx) console.log(`${t._id}   sales: ${String(t.sales).padStart(3)}   commission: ${t.commission.toFixed(2)}`)
const lastTx = await db.collection('awin_transactions').find({}).sort({ transactionDate: -1 }).limit(1).next()
console.log(`Newest sale: ${lastTx ? `${day(lastTx.transactionDate)}  ${lastTx.merchantName || ''}  ${lastTx.status || ''}  via ${lastTx.source || '?'}` : '—'}`)
const total = await db.collection('awin_transactions').estimatedDocumentCount()
console.log(`All sales stored: ${total}`)

// 3. Live AWIN API (read-only)
console.log('\n=== 3. AWIN API right now (last 3 days) ===')
const token = process.env.AWIN_API_TOKEN
const publisherId = process.env.AWIN_PUBLISHER_ID || process.env.AWIN_AFFILIATE_ID
if (!token || !publisherId) {
  console.log(`Not configured: AWIN_API_TOKEN ${token ? 'set' : 'MISSING'}, publisher id ${publisherId || 'MISSING'}`)
  console.log('→ Sales then only arrive via the AWIN webhook.')
} else {
  const end = new Date()
  const url = new URL(`https://api.awin.com/publishers/${publisherId}/transactions/`)
  url.searchParams.set('startDate', since(3).toISOString().slice(0, 19))
  url.searchParams.set('endDate', end.toISOString().slice(0, 19))
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('dateType', 'transaction')
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
    if (!res.ok) {
      console.log(`AWIN API error ${res.status}: ${(await res.text()).slice(0, 200)}`)
      if (res.status === 401 || res.status === 403) console.log('→ The API token is invalid or expired: create a new one at https://ui.awin.com/awin-api')
    } else {
      const list = await res.json()
      console.log(`AWIN reports ${Array.isArray(list) ? list.length : 0} transaction(s) in the last 3 days`)
      for (const t of (Array.isArray(list) ? list : []).slice(0, 10)) {
        console.log(`  ${day(t.transactionDate)}  ${t.advertiserName || t.advertiserId}  ${t.commissionStatus}  ${t.commissionAmount?.amount ?? ''} ${t.commissionAmount?.currency ?? ''}`)
      }
    }
  } catch (err) {
    console.log('AWIN API not reachable:', err?.message || err)
  }
}
console.log('')
await mongoose.disconnect()
