import cron from 'node-cron'
import Product from '../../models/product.js'
import ProductInterest from '../../models/productInterest.js'
import PushSubscription from '../../models/pushSubscription.js'
import { sendPushToUuid } from '../push/push.service.js'

const SITE_URL = (
  process.env.FRONTEND_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  'https://www.reifexa.de'
).replace(/\/$/, '')

/** Minimum relative change to notify (e.g. 0.02 = 2%) */
const MIN_CHANGE_RATIO = Number(process.env.PUSH_PRICE_CHANGE_MIN || 0.02)
/** Don't spam the same interest more often than this (hours) */
const COOLDOWN_HOURS = Number(process.env.PUSH_ALERT_COOLDOWN_HOURS || 6)

function pctChange(oldPrice, newPrice) {
  if (!Number.isFinite(oldPrice) || oldPrice <= 0) return null
  if (!Number.isFinite(newPrice) || newPrice <= 0) return null
  return ((newPrice - oldPrice) / oldPrice) * 100
}

function formatEUR(n) {
  return `${Number(n).toFixed(2).replace('.', ',')} €`
}

function currentCheapest(product) {
  const candidates = [
    Number(product?.search_price),
    Number(product?.cheapest_offer),
    ...(Array.isArray(product?.offers)
      ? product.offers.map(o => Number(o?.price))
      : []),
  ].filter(n => Number.isFinite(n) && n > 0)
  if (!candidates.length) return null
  return Math.min(...candidates)
}

function findVendorOffer(product, vendorId, vendorName) {
  const offers = Array.isArray(product?.offers) ? product.offers : []
  return (
    offers.find(
      o =>
        (vendorId && o.vendor_id === vendorId) ||
        (vendorName && o.vendor === vendorName)
    ) || null
  )
}

function findCheapestVendorOffer(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : []
  let best = null
  for (const o of offers) {
    const price = Number(o?.price)
    if (!Number.isFinite(price) || price <= 0) continue
    if (!best || price < best.price) {
      best = {
        vendor: o.vendor || 'Händler',
        vendor_id: o.vendor_id || '',
        price,
      }
    }
  }
  return best
}

function cooldownOk(interest) {
  if (!interest.lastNotifiedAt) return true
  const ms = COOLDOWN_HOURS * 60 * 60 * 1000
  return Date.now() - new Date(interest.lastNotifiedAt).getTime() >= ms
}

/**
 * Build alert payloads for one interest vs current product.
 * Returns array of { kind, title, body, url, tag, meta }
 */
function buildAlerts(interest, product) {
  const alerts = []
  const name =
    [product.brand_name, product.product_name, product.dimensions]
      .filter(Boolean)
      .join(' ')
      .trim() || interest.productName || 'Ihr Reifen'
  const url = `${SITE_URL}/produkte/${product.slug || interest.slug}`
  const newPrice = currentCheapest(product)
  const oldPrice = Number(interest.lastPrice)

  // 0) New cheaper vendor appeared vs last snapshot
  const prevVendors = Array.isArray(interest.lastVendorPrices)
    ? interest.lastVendorPrices
    : []
  const currentBest = findCheapestVendorOffer(product)
  if (currentBest && prevVendors.length) {
    const prevBest = [...prevVendors].sort(
      (a, b) => Number(a.price) - Number(b.price)
    )[0]
    const prevPrice = Number(prevBest?.price)
    if (
      Number.isFinite(prevPrice) &&
      currentBest.price < prevPrice * (1 - MIN_CHANGE_RATIO) &&
      currentBest.vendor &&
      currentBest.vendor !== prevBest?.vendor
    ) {
      const absPct = (
        ((prevPrice - currentBest.price) / prevPrice) *
        100
      )
        .toFixed(1)
        .replace('.', ',')
      alerts.push({
        kind: 'cheaper_vendor',
        title: `Günstigerer Händler: ${currentBest.vendor}`,
        body: `${name} jetzt bei ${currentBest.vendor} für ${formatEUR(currentBest.price)} (−${absPct}% vs. vorher).`,
        url,
        tag: `cheap-vendor-${product._id || interest.productId}`,
        meta: { vendor: currentBest.vendor, price: currentBest.price },
      })
    }
  }

  // 1) Overall cheapest price change
  if (
    Number.isFinite(oldPrice) &&
    oldPrice > 0 &&
    Number.isFinite(newPrice) &&
    newPrice > 0
  ) {
    const pct = pctChange(oldPrice, newPrice)
    if (pct != null && Math.abs(pct) / 100 >= MIN_CHANGE_RATIO) {
      const down = pct < 0
      const absPct = Math.abs(pct).toFixed(1).replace('.', ',')
      alerts.push({
        kind: down ? 'price_drop' : 'price_rise',
        title: down
          ? `Preis gesunken: ${name}`
          : `Preis gestiegen: ${name}`,
        body: down
          ? `Jetzt ${formatEUR(newPrice)} (−${absPct}%). Vorher ${formatEUR(oldPrice)}.`
          : `Jetzt ${formatEUR(newPrice)} (+${absPct}%). Vorher ${formatEUR(oldPrice)}.`,
        url,
        tag: `price-${product._id}`,
        meta: { oldPrice, newPrice, pct },
      })
    }
  }

  // 2) Preferred vendor (clicked / purchase intent) price change
  if (interest.preferredVendor || interest.preferredVendorId) {
    const offer = findVendorOffer(
      product,
      interest.preferredVendorId,
      interest.preferredVendor
    )
    const vendorOld = Number(interest.preferredVendorLastPrice)
    const vendorNew = offer ? Number(offer.price) : null
    const vendorLabel = interest.preferredVendor || offer?.vendor || 'Händler'

    if (
      offer &&
      Number.isFinite(vendorOld) &&
      vendorOld > 0 &&
      Number.isFinite(vendorNew) &&
      vendorNew > 0
    ) {
      const pct = pctChange(vendorOld, vendorNew)
      if (pct != null && Math.abs(pct) / 100 >= MIN_CHANGE_RATIO) {
        const down = pct < 0
        const absPct = Math.abs(pct).toFixed(1).replace('.', ',')
        alerts.push({
          kind: down ? 'vendor_price_drop' : 'vendor_price_rise',
          title: down
            ? `${vendorLabel}: Angebot günstiger`
            : `${vendorLabel}: Preis gestiegen`,
          body: down
            ? `${name} bei ${vendorLabel}: ${formatEUR(vendorNew)} (−${absPct}%).`
            : `${name} bei ${vendorLabel}: ${formatEUR(vendorNew)} (+${absPct}%).`,
          url,
          tag: `vendor-${product._id}-${interest.preferredVendorId || vendorLabel}`,
          meta: { vendorOld, vendorNew, pct, vendor: vendorLabel },
        })
      }
    }

    // Vendor disappeared / no longer listed
    if (!offer && interest.preferredVendorLastPrice != null) {
      alerts.push({
        kind: 'vendor_offer_gone',
        title: `Angebot bei ${vendorLabel} nicht mehr verfügbar`,
        body: `Prüfen Sie aktuelle Alternativen für ${name}.`,
        url,
        tag: `vendor-gone-${product._id}`,
        meta: {},
      })
    }
  }

  // 3) New / additional offers (e.g. new shop version of same product)
  const newOfferCount = Array.isArray(product.offers) ? product.offers.length : 0
  const oldOfferCount = Number(interest.lastOfferCount) || 0
  if (oldOfferCount > 0 && newOfferCount > oldOfferCount) {
    const added = newOfferCount - oldOfferCount
    alerts.push({
      kind: 'new_offers',
      title: `Neue Angebote für ${name}`,
      body: `${added} neue Händler-Angebote verfügbar. Günstigster Preis: ${
        newPrice != null ? formatEUR(newPrice) : 'jetzt prüfen'
      }.`,
      url,
      tag: `offers-${product._id}`,
      meta: { oldOfferCount, newOfferCount },
    })
  }

  // 4) After purchase intent: highlight if a clearly better deal appeared
  if (
    interest.purchaseIntentAt &&
    Number.isFinite(oldPrice) &&
    oldPrice > 0 &&
    Number.isFinite(newPrice) &&
    newPrice > 0 &&
    newPrice < oldPrice * (1 - Math.max(MIN_CHANGE_RATIO, 0.03))
  ) {
    // already covered by price_drop; skip duplicate if we have one
    if (!alerts.some(a => a.kind === 'price_drop')) {
      const pct = pctChange(oldPrice, newPrice)
      alerts.push({
        kind: 'better_deal',
        title: `Besseres Angebot: ${name}`,
        body: `Nach Ihrem Interesse: jetzt ${formatEUR(newPrice)} (${Math.abs(pct).toFixed(1).replace('.', ',')}% günstiger).`,
        url,
        tag: `deal-${product._id}`,
        meta: { oldPrice, newPrice },
      })
    }
  }

  return alerts
}

function snapshotVendorPrices(product) {
  const offers = Array.isArray(product?.offers) ? product.offers : []
  return offers
    .filter(o => o && (o.vendor || o.vendor_id) && Number.isFinite(Number(o.price)))
    .map(o => ({
      vendor: o.vendor || '',
      vendor_id: o.vendor_id || '',
      price: Number(o.price),
    }))
}

export async function runPriceAlertPass() {
  const started = Date.now()
  console.log('[PRICE-ALERT] Starting pass…')

  // Only interests for users that still have an enabled push subscription
  const activeUuids = await PushSubscription.distinct('uuid', { enabled: true })
  if (!activeUuids.length) {
    console.log('[PRICE-ALERT] No active push subscribers')
    return { checked: 0, sent: 0 }
  }

  const interests = await ProductInterest.find({
    notifyEnabled: true,
    uuid: { $in: activeUuids },
  })
    .limit(5000)
    .lean()

  if (!interests.length) {
    console.log('[PRICE-ALERT] No product interests')
    return { checked: 0, sent: 0 }
  }

  const productIds = [...new Set(interests.map(i => String(i.productId)))]
  const products = await Product.find({ _id: { $in: productIds } })
    .select(
      'slug product_name brand_name dimensions search_price cheapest_offer offers'
    )
    .lean()
  const byId = new Map(products.map(p => [String(p._id), p]))

  let sent = 0
  let checked = 0

  for (const interest of interests) {
    checked += 1
    if (!cooldownOk(interest)) continue

    const product = byId.get(String(interest.productId))
    if (!product) continue

    const alerts = buildAlerts(interest, product)
    if (!alerts.length) {
      // Still refresh snapshots so we don't false-trigger later
      const newPrice = currentCheapest(product)
      const preferred = findVendorOffer(
        product,
        interest.preferredVendorId,
        interest.preferredVendor
      )
      await ProductInterest.updateOne(
        { _id: interest._id },
        {
          $set: {
            lastPrice: newPrice,
            lastVendorPrices: snapshotVendorPrices(product),
            lastOfferCount: Array.isArray(product.offers)
              ? product.offers.length
              : 0,
            ...(preferred
              ? { preferredVendorLastPrice: Number(preferred.price) }
              : {}),
          },
        }
      )
      continue
    }

    // Send the highest-priority alert only (avoid multi-notify spam)
    const priority = [
      'cheaper_vendor',
      'price_drop',
      'vendor_price_drop',
      'better_deal',
      'new_offers',
      'vendor_price_rise',
      'price_rise',
      'vendor_offer_gone',
    ]
    alerts.sort(
      (a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind)
    )
    const alert = alerts[0]

    const result = await sendPushToUuid(interest.uuid, {
      title: alert.title,
      body: alert.body,
      url: alert.url,
      tag: alert.tag,
      kind: alert.kind,
      icon: `${SITE_URL}/images/favicon.png`,
      badge: `${SITE_URL}/images/favicon.png`,
    })

    if (result.sent > 0) {
      sent += result.sent
      const newPrice = currentCheapest(product)
      const preferred = findVendorOffer(
        product,
        interest.preferredVendorId,
        interest.preferredVendor
      )
      await ProductInterest.updateOne(
        { _id: interest._id },
        {
          $set: {
            lastPrice: newPrice,
            lastVendorPrices: snapshotVendorPrices(product),
            lastOfferCount: Array.isArray(product.offers)
              ? product.offers.length
              : 0,
            lastNotifiedAt: new Date(),
            lastNotifiedKind: alert.kind,
            ...(preferred
              ? { preferredVendorLastPrice: Number(preferred.price) }
              : {}),
          },
        }
      )
    }
  }

  console.log(
    `[PRICE-ALERT] Done in ${Date.now() - started}ms — checked=${checked} sent=${sent}`
  )
  return { checked, sent }
}

/** Hourly price-alert cron (also runs once shortly after boot). */
export function startPriceAlertCron() {
  // Every hour at minute 15
  cron.schedule('15 * * * *', () => {
    runPriceAlertPass().catch(err =>
      console.error('[PRICE-ALERT] cron error:', err)
    )
  })

  // Warm-up pass after 2 minutes (lets AWIN import settle)
  setTimeout(() => {
    runPriceAlertPass().catch(err =>
      console.error('[PRICE-ALERT] warmup error:', err)
    )
  }, 120000)

  console.log('[PRICE-ALERT] Cron scheduled (hourly at :15)')
}

export default { startPriceAlertCron, runPriceAlertPass }
