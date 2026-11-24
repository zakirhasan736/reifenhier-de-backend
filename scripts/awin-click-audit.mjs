#!/usr/bin/env node
/**
 * AWIN click + sale audit: does every shop click arrive at AWIN, and does every
 * AWIN sale arrive in our database? Read-only.
 *
 *   node scripts/awin-click-audit.mjs            # last 3 days (Berlin days)
 *   node scripts/awin-click-audit.mjs --days 7
 *   npm run awin:audit
 *
 * Per shop and day it compares
 *   - our clicks (and unique visitors) from the `clicks` collection
 *   - the clicks AWIN registered (AWIN Publisher API, advertiser report)
 *   - the sales AWIN reports vs. the sales we stored (poller / webhook)
 * and builds one real exit link per shop to check publisher id, merchant id,
 * clickref and the landing domain.
 *
 * Needs MONGODB_URI, AWIN_API_TOKEN, AWIN_PUBLISHER_ID (or AWIN_AFFILIATE_ID).
 */
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })

const daysArg = process.argv.find((arg, i) => process.argv[i - 1] === '--days')
const DAYS = Math.min(Math.max(Number(daysArg) || 3, 1), 30)
const TZ = 'Europe/Berlin'
const TOKEN = process.env.AWIN_API_TOKEN
const PUBLISHER = process.env.AWIN_PUBLISHER_ID || process.env.AWIN_AFFILIATE_ID
const AFFILIATE = process.env.AWIN_AFFILIATE_ID || PUBLISHER

const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ })
const days = Array.from({ length: DAYS }, (_, i) => dayKey(Date.now() - i * 864e5)).reverse()
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–')
const pad = (s, n) => String(s ?? '').slice(0, n).padEnd(n)
const num = (v) => Number(v) || 0

/* ------------------------------------------------------------ AWIN API */

async function awin(pathname, params) {
  const url = new URL(`https://api.awin.com/publishers/${PUBLISHER}/${pathname}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}`, Accept: 'application/json' } })
  if (!r.ok) throw new Error(`AWIN ${pathname} ${r.status}: ${(await r.text()).slice(0, 160)}`)
  return r.json()
}

/** Clicks + sales per advertiser for one Berlin day (AWIN advertiser performance report). */
async function awinDay(day) {
  const rows = await awin('reports/advertiser', { startDate: day, endDate: day, region: 'DE', timezone: TZ })
  const out = new Map()
  for (const r of Array.isArray(rows) ? rows : []) {
    out.set(String(r.advertiserId), {
      name: r.advertiserName,
      clicks: num(r.clicks),
      sales: num(r.totalNo) || num(r.pendingNo) + num(r.confirmedNo) + num(r.declinedNo) + num(r.bonusNo),
      declined: num(r.declinedNo),
      value: num(r.totalValue),
      commission: num(r.totalComm),
    })
  }
  return out
}

/* ---------------------------------------------------------------- main */

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}
await mongoose.connect(process.env.MONGODB_URI)
const db = mongoose.connection.db
const since = new Date(new Date(`${days[0]}T00:00:00`).getTime() - 2 * 3600e3)

const [clicks, sales] = await Promise.all([
  db.collection('clicks').find(
    { clicked_at: { $gte: since } },
    { projection: { clicked_at: 1, vendor: 1, vendor_id: 1, awin_merchant_id: 1, awin_affiliate_id: 1, clickref: 1, uuid: 1, ip: 1, behavior: 1 } }
  ).toArray(),
  db.collection('awin_transactions').find(
    { $or: [{ transactionDate: { $gte: since } }, { createdAt: { $gte: since } }] },
    { projection: { transactionDate: 1, createdAt: 1, merchantId: 1, merchantName: 1, status: 1, clickRef: 1, saleAmount: 1 } }
  ).toArray(),
])

// our side, per day + merchant
const ours = new Map() // `${day}|${mid}` → {...}
const names = new Map()
const linkProblems = new Map() // mid → {noAffiliate, wrongAffiliate, noClickref, total}
for (const c of clicks) {
  const mid = String(c.awin_merchant_id || c.vendor_id || c.vendor || '?')
  if (c.vendor) names.set(mid, c.vendor)
  const k = `${dayKey(c.clicked_at)}|${mid}`
  const o = ours.get(k) || { clicks: 0, visitors: new Set() }
  o.clicks++
  o.visitors.add(c.uuid && c.uuid !== 'guest' ? c.uuid : `ip:${c.ip}`)
  ours.set(k, o)
  const p = linkProblems.get(mid) || { total: 0, noAffiliate: 0, wrongAffiliate: 0, noClickref: 0 }
  p.total++
  if (!c.awin_affiliate_id) p.noAffiliate++
  else if (AFFILIATE && String(c.awin_affiliate_id) !== String(AFFILIATE)) p.wrongAffiliate++
  if (!c.clickref) p.noClickref++
  linkProblems.set(mid, p)
}
const stored = new Map() // `${day}|${mid}` → {sales, withRef}
for (const t of sales) {
  const mid = String(t.merchantId || '?')
  if (t.merchantName) names.set(mid, names.get(mid) || t.merchantName)
  const k = `${dayKey(t.transactionDate || t.createdAt)}|${mid}`
  const s = stored.get(k) || { sales: 0, withRef: 0 }
  s.sales++
  if (/^rx-/.test(String(t.clickRef || ''))) s.withRef++
  stored.set(k, s)
}

// AWIN side
const awinByDay = new Map()
let awinError = ''
if (TOKEN && PUBLISHER) {
  for (const d of days) {
    try {
      awinByDay.set(d, await awinDay(d))
    } catch (err) {
      awinError = err.message
      break
    }
  }
} else {
  awinError = 'AWIN_API_TOKEN / AWIN_PUBLISHER_ID not set – AWIN columns are empty'
}
for (const m of awinByDay.values()) for (const [mid, r] of m) if (r.name) names.set(mid, names.get(mid) || r.name)

const merchants = [...new Set([...ours.keys(), ...stored.keys()].map((k) => k.split('|')[1]))]
  .filter((m) => m !== '?')
  .sort((a, b) => String(names.get(a) || a).localeCompare(String(names.get(b) || b)))

console.log(`\nAWIN click & sale audit – ${days[0]} … ${days[days.length - 1]} (${TZ})`)
if (awinError) console.log(`⚠  ${awinError}`)
console.log('\n' + pad('Day', 11) + pad('Shop', 22) + pad('our clicks', 11) + pad('visitors', 9) + pad('AWIN clicks', 12) + pad('arrived', 8) + pad('AWIN sales', 11) + pad('stored', 7) + 'verdict')

const findings = []
for (const mid of merchants) {
  for (const d of days) {
    const o = ours.get(`${d}|${mid}`)
    const s = stored.get(`${d}|${mid}`)
    const a = awinByDay.get(d)?.get(mid)
    if (!o && !s && !a?.clicks && !a?.sales) continue
    const our = o?.clicks || 0
    const vis = o?.visitors.size || 0
    let verdict = 'ok'
    if (a) {
      if (vis >= 3 && a.clicks === 0) verdict = '✗ clicks do NOT reach AWIN'
      else if (vis >= 5 && a.clicks < vis * 0.6) verdict = '⚠ AWIN sees far fewer clicks'
      if (a.sales > (s?.sales || 0)) verdict += ` · ⚠ ${a.sales - (s?.sales || 0)} AWIN sale(s) missing in our DB`
    } else if (!awinError) verdict = vis >= 3 ? '✗ merchant missing in AWIN report' : 'ok'
    if (verdict !== 'ok') findings.push(`${d} ${names.get(mid) || mid}: ${verdict}`)
    console.log(
      pad(d, 11) + pad(names.get(mid) || mid, 22) + pad(our, 11) + pad(vis, 9) + pad(a ? a.clicks : '–', 12) +
        pad(a ? pct(a.clicks, vis) : '–', 8) + pad(a ? a.sales : '–', 11) + pad(s?.sales || 0, 7) + verdict
    )
  }
}

console.log('\nLink check (one real exit link per shop, built like a live click)')
const { default: affiliateCloak } = await import('../src/api/utils/affiliateCloak.js')
const { buildVendorExitTarget } = await import('../src/api/utils/affiliate.js')
for (const mid of merchants) {
  const prod = await db.collection('products').findOne(
    { offers: { $elemMatch: { vendor_id: { $in: [mid, Number(mid)] }, affiliate_product_cloak_url: { $exists: true, $ne: '' } } } },
    { projection: { _id: 1, 'offers.$': 1 } }
  )
  const offer = prod?.offers?.[0]
  const p = linkProblems.get(mid)
  const stats = p ? ` · clicks without publisher id ${p.noAffiliate}/${p.total}, wrong publisher id ${p.wrongAffiliate}, without clickref ${p.noClickref}` : ''
  if (!offer) {
    console.log(`  ${pad(names.get(mid) || mid, 22)} no current offer with a link${stats}`)
    continue
  }
  const decoded = affiliateCloak.decodeAffiliateUrl(offer.affiliate_product_cloak_url)
  if (!decoded) {
    console.log(`  ${pad(names.get(mid) || mid, 22)} ✗ link token cannot be decoded (AWIN_CLOAK_SECRET changed?)${stats}`)
    findings.push(`${names.get(mid) || mid}: link token cannot be decoded`)
    continue
  }
  const exit = await buildVendorExitTarget(decoded, { productId: String(prod._id), uuid: 'audit', from: 'audit', vendor: offer.vendor, vendorId: mid })
  let u
  try {
    u = new URL(exit)
  } catch {
    console.log(`  ${pad(names.get(mid) || mid, 22)} ✗ invalid URL: ${exit.slice(0, 80)}`)
    continue
  }
  const q = (k) => u.searchParams.get(k)
  const pub = q('awinaffid') || q('a')
  const mer = q('awinmid') || q('m')
  let land = ''
  try {
    land = new URL(q('ued') || q('p') || '').hostname
  } catch {
    land = q('ued') || q('p') ? '(not a URL)' : '(AWIN default page)'
  }
  const problems = []
  if (!/(^|\.)awin1\.com$/i.test(u.hostname)) problems.push('not an AWIN link')
  if (!pub) problems.push('publisher id missing')
  else if (AFFILIATE && pub !== String(AFFILIATE)) problems.push(`publisher id ${pub} ≠ ${AFFILIATE}`)
  if (!mer) problems.push('merchant id missing')
  else if (mer !== mid) problems.push(`merchant id ${mer} ≠ ${mid}`)
  if (!q('clickref')) problems.push('clickref missing')
  if (problems.length) findings.push(`${names.get(mid) || mid}: ${problems.join(', ')}`)
  console.log(`  ${pad(names.get(mid) || mid, 22)} ${problems.length ? '✗ ' + problems.join(', ') : '✓'} · AWIN mid ${mer} · lands on ${land}${stats}`)
}

console.log(findings.length ? `\nFindings:\n  - ${findings.join('\n  - ')}` : '\n✓ No tracking problem found: clicks reach AWIN and every AWIN sale is in our database.')
console.log(`
How to read it
  arrived   AWIN clicks ÷ our unique visitors. 60–100% is normal (AWIN removes repeat clicks
            and bots). Near 0% means the shop's links do not reach AWIN.
  AWIN sales  what AWIN attributes to Reifexa. Shops report sales to AWIN themselves, often
            hours or a day later; a visitor can also buy days later (cookie) or not at all.
  stored    sales our poller/webhook saved. Lower than AWIN sales = poller problem.`)
await mongoose.disconnect()
