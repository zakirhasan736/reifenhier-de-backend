/**
 * Owner-only end-to-end check of the affiliate chain, per vendor:
 *   stored offer token → decode → exit URL exactly as /r/:token builds it →
 *   AWIN host, publisher id (a), advertiser id (m), clickref …
 * plus clicks vs. AWIN sales per vendor and the sale-import configuration.
 *
 * Read-only: no click is logged, no request leaves the server.
 */
import Product from '../../models/product.js'
import Click from '../../models/click.js'
import AwinTransaction from '../../models/awinTransaction.js'
import affiliateCloak from '../utils/affiliateCloak.js'
import { prepareAwinExitUrl } from '../utils/awinTracking.js'

const SAMPLE_PER_VENDOR = 25

export function checkExitUrl(token, { vendorId, productId, expectedA }) {
  const problems = []
  const decoded = affiliateCloak.decodeAffiliateUrl(token)
  if (!decoded) return { ok: false, problems: ['token_not_decodable'] }
  const exit = prepareAwinExitUrl(decoded, {
    productId,
    uuid: 'check',
    from: 'tracking-check',
    vendorId,
    affiliateId: expectedA,
  })
  let u
  try {
    u = new URL(exit)
  } catch {
    return { ok: false, problems: ['invalid_url'] }
  }
  if (!/(^|\.)awin1\.com$/i.test(u.hostname)) problems.push('not_awin_link')
  const a = u.searchParams.get('a') || u.searchParams.get('awinaffid') || ''
  if (!a) problems.push('publisher_id_missing')
  else if (expectedA && a !== String(expectedA)) problems.push(`publisher_id_wrong:${a}`)
  const m = u.searchParams.get('m') || u.searchParams.get('awinmid') || ''
  if (!m) problems.push('advertiser_id_missing')
  else if (vendorId && m !== String(vendorId)) problems.push(`advertiser_id_mismatch:${m}`)
  if (!/^rx-/.test(u.searchParams.get('clickref') || '')) problems.push('clickref_missing')
  if (!u.searchParams.get('p') && !u.searchParams.get('ued')) problems.push('target_missing')
  return { ok: problems.length === 0, problems, sample: problems.length ? exit : undefined }
}

export async function getTrackingCheck(days = 30) {
  const expectedA = process.env.AWIN_AFFILIATE_ID || process.env.AWIN_PUBLISHER_ID || ''
  const since = new Date(Date.now() - days * 86400000)

  const [offersByVendor, clicks, sales, lastTx] = await Promise.all([
    Product.aggregate([
      { $unwind: '$offers' },
      {
        $group: {
          _id: { id: '$offers.vendor_id', name: '$offers.vendor' },
          offers: { $sum: 1 },
          withToken: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$offers.affiliate_product_cloak_url', ''] } }, 0] }, 1, 0] } },
          samples: { $push: { t: '$offers.affiliate_product_cloak_url', p: '$_id' } },
        },
      },
      { $project: { offers: 1, withToken: 1, samples: { $slice: ['$samples', SAMPLE_PER_VENDOR] } } },
      { $sort: { offers: -1 } },
    ]),
    Click.aggregate([
      { $match: { clicked_at: { $gte: since }, behavior: { $in: [null, 'vendor_exit'] } } },
      { $group: { _id: '$awin_merchant_id', clicks: { $sum: 1 }, last: { $max: '$clicked_at' } } },
    ]),
    AwinTransaction.aggregate([
      { $match: { $or: [{ transactionDate: { $gte: since } }, { createdAt: { $gte: since } }] } },
      {
        $group: {
          _id: '$merchantId',
          sales: { $sum: 1 },
          declined: { $sum: { $cond: [{ $eq: [{ $toLower: { $ifNull: ['$status', ''] } }, 'declined'] }, 1, 0] } },
          commission: { $sum: { $ifNull: ['$commission', 0] } },
          last: { $max: { $ifNull: ['$transactionDate', '$createdAt'] } },
          withClickRef: { $sum: { $cond: [{ $regexMatch: { input: { $ifNull: ['$clickRef', ''] }, regex: /^rx-/ } }, 1, 0] } },
        },
      },
    ]),
    AwinTransaction.findOne().sort({ createdAt: -1 }).select('createdAt source').lean(),
  ])

  const clickBy = Object.fromEntries(clicks.map(c => [String(c._id || ''), c]))
  const saleBy = Object.fromEntries(sales.map(s => [String(s._id || ''), s]))

  const vendors = offersByVendor.map(v => {
    const vendorId = String(v._id.id || '')
    const problemCounts = {}
    let checked = 0
    let passed = 0
    let example
    for (const s of v.samples) {
      if (!s.t) continue
      checked += 1
      const r = checkExitUrl(s.t, { vendorId, productId: String(s.p), expectedA })
      if (r.ok) passed += 1
      else {
        for (const p of r.problems) problemCounts[p] = (problemCounts[p] || 0) + 1
        example = example || r.sample
      }
    }
    const c = clickBy[vendorId] || {}
    const sl = saleBy[vendorId] || {}
    const status =
      !vendorId || checked === 0 || passed < checked ? 'error' : (c.clicks || 0) >= 30 && !(sl.sales || 0) ? 'warning' : 'ok'
    return {
      vendor: v._id.name || '(unbekannt)',
      vendorId,
      offers: v.offers,
      offersWithoutToken: v.offers - v.withToken,
      linksChecked: checked,
      linksOk: passed,
      problems: problemCounts,
      exampleProblemUrl: example,
      clicks: c.clicks || 0,
      lastClick: c.last || null,
      sales: sl.sales || 0,
      declined: sl.declined || 0,
      salesWithOurClickRef: sl.withClickRef || 0,
      commission: Math.round((sl.commission || 0) * 100) / 100,
      lastSale: sl.last || null,
      conversionPct: c.clicks ? Math.round(((sl.sales || 0) / c.clicks) * 1000) / 10 : null,
      status,
    }
  })

  // Sales from advertisers we have no offers for (feed removed / other source).
  const known = new Set(vendors.map(v => v.vendorId))
  const otherSales = sales.filter(s => !known.has(String(s._id || ''))).map(s => ({ merchantId: s._id, sales: s.sales }))

  const secret = process.env.AWIN_CLOAK_SECRET || ''
  const config = {
    publisherId: expectedA || null,
    publisherIdSet: Boolean(expectedA),
    cloakSecretSet: Boolean(secret) && secret !== 'dev-secret',
    webhookConfigured: Boolean(process.env.AWIN_WEBHOOK_SECRET),
    pollerConfigured: Boolean(process.env.AWIN_API_TOKEN && expectedA),
    lastTransactionStoredAt: lastTx?.createdAt || null,
    lastTransactionSource: lastTx?.source || null,
  }
  const configProblems = [
    !config.publisherIdSet && 'AWIN_AFFILIATE_ID fehlt',
    !config.cloakSecretSet && 'AWIN_CLOAK_SECRET fehlt oder ist der Entwicklungswert',
    !config.webhookConfigured && !config.pollerConfigured && 'Weder AWIN-Webhook noch API-Abruf eingerichtet – Verkäufe werden nicht importiert',
  ].filter(Boolean)

  return {
    days,
    checkedAt: new Date(),
    config,
    configProblems,
    totals: {
      vendors: vendors.length,
      vendorsOk: vendors.filter(v => v.status === 'ok').length,
      linksChecked: vendors.reduce((a, v) => a + v.linksChecked, 0),
      linksOk: vendors.reduce((a, v) => a + v.linksOk, 0),
      clicks: vendors.reduce((a, v) => a + v.clicks, 0),
      sales: vendors.reduce((a, v) => a + v.sales, 0) + otherSales.reduce((a, s) => a + s.sales, 0),
    },
    vendors,
    otherSales,
  }
}
