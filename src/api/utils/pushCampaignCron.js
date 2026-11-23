import cron from 'node-cron'
import Product from '../../models/product.js'
import ProductInterest from '../../models/productInterest.js'
import PushSubscription from '../../models/pushSubscription.js'
import PushCampaignLog from '../../models/pushCampaignLog.js'
import Click from '../../models/click.js'
import { sendPushToUuid } from '../push/push.service.js'

const SITE_URL = (
  process.env.FRONTEND_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.reifexa.de'
).replace(/\/$/, '')

const MAX_CAMPAIGNS_PER_DAY = Number(process.env.PUSH_MAX_CAMPAIGNS_PER_DAY || 3)
const CAMPAIGN_GAP_HOURS = Number(process.env.PUSH_CAMPAIGN_GAP_HOURS || 4)

function formatEUR(n) {
  if (!Number.isFinite(n)) return ''
  return `${Number(n).toFixed(2).replace('.', ',')} €`
}

function dayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function currentSeason() {
  const m = new Date().getMonth() + 1 // 1-12
  // DE: Winterreifen roughly Oct–Mar, Sommer Apr–Sep
  if (m >= 10 || m <= 3) {
    return {
      key: 'Winterreifen',
      label: 'Winterreifen-Saison',
      welcome:
        'Die Winterreifen-Saison ist da — vergleichen Sie aktuelle Angebote und sparen Sie.',
      path: '/produkte?kategorie=Winterreifen',
    }
  }
  if (m >= 4 && m <= 9) {
    return {
      key: 'Sommerreifen',
      label: 'Sommerreifen-Saison',
      welcome:
        'Sommerreifen im Fokus — frische Angebote und Top-Preise für die Saison.',
      path: '/produkte?kategorie=Sommerreifen',
    }
  }
  return {
    key: 'Ganzjahresreifen',
    label: 'Ganzjahresreifen',
    welcome: 'Ganzjahresreifen-Angebote — ein Reifen für jede Jahreszeit.',
    path: '/produkte?kategorie=Ganzjahresreifen',
  }
}

function cheapest(product) {
  const nums = [
    Number(product?.search_price),
    Number(product?.cheapest_offer),
    ...(Array.isArray(product?.offers)
      ? product.offers.map(o => Number(o?.price))
      : []),
  ].filter(n => Number.isFinite(n) && n > 0)
  return nums.length ? Math.min(...nums) : null
}

function cheapestVendor(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : []
  let best = null
  for (const o of offers) {
    const p = Number(o?.price)
    if (!Number.isFinite(p) || p <= 0) continue
    if (!best || p < best.price) {
      best = { vendor: o.vendor || 'Händler', vendor_id: o.vendor_id, price: p }
    }
  }
  return best
}

async function recentlySent(uuid, kind, withinHours) {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000)
  const hit = await PushCampaignLog.findOne({
    uuid,
    kind,
    sentAt: { $gte: since },
  }).lean()
  return Boolean(hit)
}

async function canSendCampaign(uuid) {
  const subs = await PushSubscription.find({ uuid, enabled: true }).lean()
  if (!subs.length) return { ok: false }

  const key = dayKey()
  // Aggregate across devices for this uuid
  let campaignsToday = 0
  let lastAt = null
  for (const s of subs) {
    if (s.campaignsDayKey === key) {
      campaignsToday = Math.max(campaignsToday, s.campaignsToday || 0)
    }
    if (s.lastCampaignAt) {
      const t = new Date(s.lastCampaignAt).getTime()
      if (!lastAt || t > lastAt) lastAt = t
    }
  }

  if (campaignsToday >= MAX_CAMPAIGNS_PER_DAY) {
    return { ok: false, reason: 'daily_cap' }
  }
  if (lastAt && Date.now() - lastAt < CAMPAIGN_GAP_HOURS * 60 * 60 * 1000) {
    return { ok: false, reason: 'gap' }
  }
  return { ok: true, subs, campaignsToday, dayKey: key }
}

async function markCampaignSent(uuid, kind, payload) {
  await PushCampaignLog.create({
    uuid,
    kind,
    title: payload.title,
    body: payload.body,
    url: payload.url,
    meta: payload.meta || {},
    sentAt: new Date(),
  })

  const key = dayKey()
  const subs = await PushSubscription.find({ uuid, enabled: true })
  for (const s of subs) {
    const sameDay = s.campaignsDayKey === key
    s.campaignsDayKey = key
    s.campaignsToday = sameDay ? (s.campaignsToday || 0) + 1 : 1
    s.lastCampaignAt = new Date()
    s.lastCampaignKind = kind
    if (kind === 'welcome') s.welcomeSentAt = new Date()
    await s.save()
  }
}

async function sendCampaign(uuid, kind, payload) {
  const gate = await canSendCampaign(uuid)
  if (!gate.ok) return { sent: 0, skipped: gate.reason }

  if (await recentlySent(uuid, kind, kind === 'welcome' ? 24 * 30 : 20)) {
    return { sent: 0, skipped: 'recent_kind' }
  }

  const result = await sendPushToUuid(uuid, {
    title: payload.title,
    body: payload.body,
    url: payload.url || `${SITE_URL}/`,
    tag: payload.tag || `campaign-${kind}`,
    kind,
    icon: `${SITE_URL}/images/favicon.png`,
    badge: `${SITE_URL}/images/favicon.png`,
  })

  if (result.sent > 0) {
    await markCampaignSent(uuid, kind, payload)
  }
  return result
}

/** Confirm the one product the visitor just allowed. No other product is mentioned. */
export async function sendProductAlertConfirm(uuid, productId) {
  if (!uuid || uuid === 'guest' || !productId) return { sent: 0 }
  const product = await Product.findById(productId)
    .select('slug brand_name product_name search_price cheapest_offer')
    .lean()
  if (!product) return { sent: 0 }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const already = await PushCampaignLog.findOne({
    uuid,
    kind: 'product_watch',
    'meta.productId': String(product._id),
    sentAt: { $gte: since },
  }).lean()
  if (already) return { sent: 0, skipped: 'recent_product' }

  const price = cheapest(product)
  const name = [product.brand_name, product.product_name].filter(Boolean).join(' ')
  const payload = {
    title: 'Preisalarm für diesen Reifen aktiv',
    body: price
      ? `${name}: wir benachrichtigen Sie nur zu diesem Reifen, wenn der Preis sinkt. Aktuell ab ${formatEUR(price)}.`
      : `${name}: wir benachrichtigen Sie nur zu diesem Reifen, wenn der Preis sinkt.`,
    url: product.slug ? `${SITE_URL}/produkte/${product.slug}` : `${SITE_URL}/`,
    tag: `watch-${product._id}`,
    meta: { productId: String(product._id) },
  }
  const result = await sendPushToUuid(uuid, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    kind: 'product_watch',
    icon: `${SITE_URL}/images/favicon.png`,
    badge: `${SITE_URL}/images/favicon.png`,
  })
  if (result.sent > 0) await markCampaignSent(uuid, 'product_watch', payload)
  return result
}

/** @deprecated Global welcome promoted unrelated products. Kept so older imports do not send it. */
export async function sendWelcomePush() {
  return { sent: 0, skipped: 'product_only' }
}

/** Cheaper vendor / better price on a recently viewed product */
async function campaignBetterVendor(uuid, interests) {
  if (await recentlySent(uuid, 'better_vendor', 18)) return null

  for (const interest of interests.slice(0, 8)) {
    const product = await Product.findById(interest.productId)
      .select(
        'slug brand_name product_name dimensions search_price cheapest_offer offers'
      )
      .lean()
    if (!product) continue

    const best = cheapestVendor(product)
    const price = cheapest(product)
    if (!best || !price) continue

    const oldPrice = Number(interest.lastPrice)
    const oldVendor = interest.preferredVendor || ''
    const vendorChanged =
      best.vendor &&
      oldVendor &&
      best.vendor !== oldVendor &&
      Number.isFinite(oldPrice) &&
      best.price < oldPrice * 0.98

    const cheaperOverall =
      Number.isFinite(oldPrice) &&
      oldPrice > 0 &&
      price < oldPrice * 0.97

    if (!vendorChanged && !cheaperOverall) continue

    const name = [product.brand_name, product.product_name]
      .filter(Boolean)
      .join(' ')

    return {
      kind: 'better_vendor',
      payload: {
        title: vendorChanged
          ? `Günstigerer Händler: ${best.vendor}`
          : `Neuer Bestpreis für Ihr Produkt`,
        body: vendorChanged
          ? `${name} jetzt bei ${best.vendor} für ${formatEUR(best.price)} (vorher ab ${formatEUR(oldPrice)}).`
          : `${name} jetzt ab ${formatEUR(price)} — ${Math.round(((oldPrice - price) / oldPrice) * 100)}% günstiger.`,
        url: `${SITE_URL}/produkte/${product.slug || interest.slug}`,
        tag: `better-vendor-${product._id}`,
        meta: { productId: String(product._id), vendor: best.vendor },
      },
    }
  }
  return null
}

/** Season welcome + seasonal offers */
async function campaignSeason(uuid) {
  if (await recentlySent(uuid, 'season', 24 * 5)) return null
  const season = currentSeason()
  const deals = await Product.find({
    merchant_product_third_category: new RegExp(season.key, 'i'),
    search_price: { $gt: 0 },
  })
    .sort({ search_price: 1 })
    .limit(3)
    .select('brand_name product_name search_price cheapest_offer slug')
    .lean()

  if (!deals.length) return null
  const top = deals[0]
  const price = cheapest(top)

  return {
    kind: 'season',
    payload: {
      title: `${season.label} — aktuelle Angebote`,
      body: `Willkommen in der ${season.label}: ${top.brand_name} ${top.product_name} ab ${formatEUR(price)}. Jetzt vergleichen.`,
      url: `${SITE_URL}${season.path}`,
      tag: `season-${season.key}`,
      meta: { season: season.key },
    },
  }
}

/** New / featured brands not yet in user's viewed set */
async function campaignNewBrand(uuid, interests) {
  if (await recentlySent(uuid, 'new_brand', 24 * 3)) return null

  const knownBrands = new Set(
    interests.map(i => (i.brandName || '').toLowerCase()).filter(Boolean)
  )

  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const fresh = await Product.find({
    updatedAt: { $gte: since },
    brand_name: { $exists: true, $ne: '' },
    search_price: { $gt: 0 },
  })
    .sort({ updatedAt: -1 })
    .limit(40)
    .select('brand_name product_name slug search_price cheapest_offer merchant_product_third_category')
    .lean()

  const candidate = fresh.find(
    p => p.brand_name && !knownBrands.has(String(p.brand_name).toLowerCase())
  )
  if (!candidate) return null

  const price = cheapest(candidate)
  return {
    kind: 'new_brand',
    payload: {
      title: `Neue Marke entdecken: ${candidate.brand_name}`,
      body: `${candidate.brand_name} ${candidate.product_name} ab ${formatEUR(price)} — frisch im Preisvergleich.`,
      url: `${SITE_URL}/produkte/${candidate.slug}`,
      tag: `new-brand-${candidate.brand_name}`,
      meta: { brand: candidate.brand_name },
    },
  }
}

/** Most popular products by clicks (last 7 days) */
async function campaignPopular(uuid) {
  if (await recentlySent(uuid, 'popular', 24 * 2)) return null

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const top = await Click.aggregate([
    { $match: { clicked_at: { $gte: since }, product_id: { $ne: null } } },
    {
      $group: {
        _id: '$product_id',
        clicks: { $sum: 1 },
        product_name: { $first: '$product_name' },
        brand_name: { $first: '$brand_name' },
      },
    },
    { $sort: { clicks: -1 } },
    { $limit: 5 },
  ])

  if (!top.length) return null
  const winner = top[0]
  const product = await Product.findById(winner._id)
    .select('slug brand_name product_name search_price cheapest_offer')
    .lean()
  if (!product) return null
  const price = cheapest(product)

  return {
    kind: 'popular',
    payload: {
      title: 'Beliebtester Reifen gerade',
      body: `${product.brand_name || winner.brand_name} ${product.product_name || winner.product_name} — ${winner.clicks} Klicks diese Woche, ab ${formatEUR(price)}.`,
      url: `${SITE_URL}/produkte/${product.slug}`,
      tag: `popular-${product._id}`,
      meta: { clicks: winner.clicks },
    },
  }
}

/** Best-selling brand with a strong deal */
async function campaignBestBrandDeal(uuid) {
  if (await recentlySent(uuid, 'best_deal', 24 * 2)) return null

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const brands = await Click.aggregate([
    {
      $match: {
        clicked_at: { $gte: since },
        brand_name: { $exists: true, $nin: [null, ''] },
      },
    },
    { $group: { _id: '$brand_name', clicks: { $sum: 1 } } },
    { $sort: { clicks: -1 } },
    { $limit: 8 },
  ])

  for (const b of brands) {
    const deal = await Product.findOne({
      brand_name: b._id,
      search_price: { $gt: 0 },
    })
      .sort({ search_price: 1 })
      .select('slug brand_name product_name search_price cheapest_offer savings_percent')
      .lean()
    if (!deal) continue
    const price = cheapest(deal)
    const savings = deal.savings_percent && deal.savings_percent !== '0%'
      ? ` (${deal.savings_percent} Ersparnis)`
      : ''

    return {
      kind: 'best_deal',
      payload: {
        title: `Top-Marke der Woche: ${b._id}`,
        body: `Meistgeklickt bei Reifexa — ${deal.product_name} ab ${formatEUR(price)}${savings}.`,
        url: `${SITE_URL}/produkte/${deal.slug}`,
        tag: `best-deal-${b._id}`,
        meta: { brand: b._id, clicks: b.clicks },
      },
    }
  }
  return null
}

/**
 * Only products a visitor explicitly allowed on the product page.
 * Season, popular, and brand blasts are not sent.
 */
export async function runPushCampaignPass() {
  const started = Date.now()
  console.log('[PUSH-CAMPAIGN] Starting pass…')

  const interests = await ProductInterest.find({ notifyEnabled: true })
    .sort({ updatedAt: -1 })
    .limit(5000)
    .lean()
  const byUuid = new Map()
  for (const interest of interests) {
    if (!interest.uuid || interest.uuid === 'guest') continue
    const list = byUuid.get(interest.uuid) || []
    list.push(interest)
    byUuid.set(interest.uuid, list)
  }

  if (!byUuid.size) {
    console.log('[PUSH-CAMPAIGN] No product subscriptions')
    return { users: 0, sent: 0 }
  }

  let sent = 0
  const uuids = [...byUuid.keys()]

  for (const uuid of uuids) {
    const gate = await canSendCampaign(uuid)
    if (!gate.ok) continue

    const chosen = await campaignBetterVendor(uuid, byUuid.get(uuid) || [])
    if (!chosen) continue

    const result = await sendCampaign(uuid, chosen.kind, chosen.payload)
    if (result.sent > 0) sent += result.sent
  }

  console.log(
    `[PUSH-CAMPAIGN] Done in ${Date.now() - started}ms — users=${uuids.length} sent=${sent}`
  )
  return { users: uuids.length, sent }
}

export function startPushCampaignCron() {
  // 3x daily: morning / midday / evening (Europe-friendly UTC offsets)
  cron.schedule('0 7,12,18 * * *', () => {
    runPushCampaignPass().catch(err =>
      console.error('[PUSH-CAMPAIGN] cron error:', err)
    )
  })

  setTimeout(() => {
    runPushCampaignPass().catch(err =>
      console.error('[PUSH-CAMPAIGN] warmup error:', err)
    )
  }, 180000)

  console.log('[PUSH-CAMPAIGN] Cron scheduled (07:00, 12:00, 18:00 UTC)')
}

export default {
  startPushCampaignCron,
  runPushCampaignPass,
  sendWelcomePush,
  sendProductAlertConfirm,
}
