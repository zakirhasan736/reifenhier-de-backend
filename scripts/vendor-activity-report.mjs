#!/usr/bin/env node
/**
 * Last N days of shop clicks and AWIN sales, one row per vendor.
 * Read-only. Nothing is written.
 *
 *   node scripts/vendor-activity-report.mjs
 *   node scripts/vendor-activity-report.mjs --days 5
 *   npm run vendors:report
 *
 * Days are Europe/Berlin calendar days, which is what the shop and AWIN use.
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const daysArg = process.argv.find((arg, i) => process.argv[i - 1] === '--days')
const days = Math.min(Math.max(Number(daysArg) || 5, 1), 90)
const TZ = 'Europe/Berlin'

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db

const since = new Date(Date.now() - days * 86400000)
const berlin = (value) =>
  value
    ? new Date(value).toLocaleString('de-DE', { timeZone: TZ, hour12: false })
    : '—'
const dayKey = (value) =>
  new Date(value).toLocaleDateString('en-CA', { timeZone: TZ })

const [clickDocs, saleDocs] = await Promise.all([
  db.collection('clicks').find(
    { clicked_at: { $gte: since } },
    {
      projection: {
        clicked_at: 1,
        vendor: 1,
        vendor_id: 1,
        awin_merchant_id: 1,
        clickref: 1,
        source: 1,
        behavior: 1,
        uuid: 1,
      },
    }
  ).toArray(),
  db.collection('awin_transactions').find(
    {
      $or: [
        { transactionDate: { $gte: since } },
        { createdAt: { $gte: since } },
      ],
    },
    {
      projection: {
        transactionDate: 1,
        createdAt: 1,
        merchantId: 1,
        merchantName: 1,
        saleAmount: 1,
        commission: 1,
        currency: 1,
        status: 1,
        clickRef: 1,
        source: 1,
      },
    }
  ).toArray(),
])

function vendorKey(id, name) {
  return `${id || '—'}|${name || '(unbekannt)'}`
}

const vendors = new Map()
function rowFor(id, name) {
  const key = vendorKey(id, name)
  if (!vendors.has(key)) {
    vendors.set(key, {
      id: id || '—',
      name: name || '(unbekannt)',
      clicks: 0,
      withRef: 0,
      visitors: new Set(),
      sales: 0,
      commission: 0,
      byDay: new Map(),
      clickTimes: [],
      salesList: [],
    })
  }
  return vendors.get(key)
}
function dayBucket(row, date) {
  const key = dayKey(date)
  if (!row.byDay.has(key)) row.byDay.set(key, { clicks: 0, sales: 0 })
  return row.byDay.get(key)
}

for (const click of clickDocs) {
  const id = String(click.awin_merchant_id || click.vendor_id || '')
  const row = rowFor(id, click.vendor)
  row.clicks += 1
  if (click.clickref) row.withRef += 1
  if (click.uuid) row.visitors.add(click.uuid)
  dayBucket(row, click.clicked_at).clicks += 1
  row.clickTimes.push({
    at: click.clicked_at,
    source: click.source || click.behavior || '',
    ref: click.clickref ? 'yes' : 'no',
  })
}

for (const sale of saleDocs) {
  const when = sale.transactionDate || sale.createdAt
  const row = rowFor(String(sale.merchantId || ''), sale.merchantName)
  row.sales += 1
  row.commission += Number(sale.commission) || 0
  dayBucket(row, when).sales += 1
  row.salesList.push({
    at: when,
    amount: sale.saleAmount,
    commission: sale.commission,
    currency: sale.currency || 'EUR',
    status: sale.status || '(none)',
    ref: sale.clickRef ? 'yes' : 'no',
    via: sale.source || '',
  })
}

const list = [...vendors.values()].sort((a, b) => b.clicks - a.clicks || b.sales - a.sales)
const dayList = []
for (let i = days - 1; i >= 0; i -= 1) {
  dayList.push(dayKey(Date.now() - i * 86400000))
}

const pad = (value, width) => String(value).padStart(width)
console.log(`\nVendor clicks and sales — last ${days} days (${TZ})`)
console.log(`Window starts ${berlin(since)} Berlin`)
console.log(`Clicks logged: ${clickDocs.length}    Sales stored: ${saleDocs.length}`)
console.log('A click is a shop exit on Reifexa. A sale is a transaction AWIN sent us.\n')

console.log('Vendor'.padEnd(24) + 'Id'.padEnd(8) + 'Clicks'.padStart(7) + '  Visitors'.padStart(10) + '  Clickref'.padStart(10) + '  Sales'.padStart(7) + '  Commission')
console.log('-'.repeat(84))
for (const vendor of list) {
  console.log(
    vendor.name.slice(0, 23).padEnd(24) +
    String(vendor.id).padEnd(8) +
    pad(vendor.clicks, 7) +
    pad(vendor.visitors.size, 10) +
    pad(vendor.withRef, 10) +
    pad(vendor.sales, 7) +
    `  ${(vendor.commission || 0).toFixed(2)} EUR`
  )
}
if (!list.length) console.log('No clicks and no sales in this window.')

console.log('\nPer day (clicks / sales)')
const header = 'Vendor'.padEnd(24) + dayList.map((day) => day.slice(5).padStart(12)).join('')
console.log(header)
console.log('-'.repeat(24 + dayList.length * 12))
for (const vendor of list) {
  const cells = dayList.map((day) => {
    const bucket = vendor.byDay.get(day) || { clicks: 0, sales: 0 }
    return `${bucket.clicks}/${bucket.sales}`.padStart(12)
  })
  console.log(vendor.name.slice(0, 23).padEnd(24) + cells.join(''))
}

const quiet = list.filter((vendor) => vendor.clicks > 0 && vendor.sales === 0)
if (quiet.length) {
  console.log('\nClicked, no sale stored in this window:')
  for (const vendor of quiet) {
    const label = vendor.clicks === 1 ? 'click' : 'clicks'
    console.log(`  ${vendor.name} (${vendor.id}): ${vendor.clicks} ${label}`)
  }
}

console.log('\nSales')
const sales = list.flatMap((vendor) => vendor.salesList.map((sale) => ({ vendor, sale })))
sales.sort((a, b) => new Date(b.sale.at) - new Date(a.sale.at))
if (!sales.length) console.log('  none')
for (const item of sales) {
  const sale = item.sale
  console.log(
    `  ${berlin(sale.at)}  ${item.vendor.name} (${item.vendor.id})  ` +
    `${sale.amount ?? '—'} ${sale.currency}  commission ${sale.commission ?? '—'}  ` +
    `status ${sale.status}  clickref ${sale.ref}  via ${sale.via || '—'}`
  )
}

const focus = list.filter((vendor) => /reifen\s*\.?\s*de/i.test(vendor.name) || vendor.id === '10719')
console.log('\nreifen.de click times (Berlin)')
if (!focus.length) console.log('  no reifen.de clicks in this window')
for (const vendor of focus) {
  const times = [...vendor.clickTimes].sort((a, b) => new Date(a.at) - new Date(b.at))
  const byDay = new Map()
  for (const click of times) {
    const key = dayKey(click.at)
    byDay.set(key, (byDay.get(key) || 0) + 1)
  }
  console.log(`  ${vendor.name} (${vendor.id}): ${vendor.clicks} clicks, ${vendor.sales} sales`)
  for (const day of dayList) console.log(`    ${day}: ${byDay.get(day) || 0} clicks`)
  for (const click of times) {
    console.log(`    ${berlin(click.at)}  ${click.source || '—'}  clickref ${click.ref}`)
  }
}

console.log('')
await mongoose.disconnect()
