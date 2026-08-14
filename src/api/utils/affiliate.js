import express from 'express'
import affiliateCloak from './affiliateCloak.js'
import { appendAwinClickRef, buildAwinClickRef } from './awinTracking.js'
import Product from '../../models/product.js'
import Click from '../../models/click.js'
import ProductInterest from '../../models/productInterest.js'
import geoip from 'geoip-lite'

const router = express.Router()

function anonymizeIp(ip) {
  if (!ip || ip === 'unknown') return 'unknown'
  if (ip.includes('.')) {
    return ip.split('.').slice(0, 3).join('.') + '.0'
  }
  return ip
}

function clientContext(req) {
  const rawIp =
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'

  const ip = anonymizeIp(rawIp)

  let country =
    req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || null
  let city =
    req.headers['cf-ipcity'] || req.headers['x-vercel-ip-city'] || null

  if (!country && rawIp !== 'unknown') {
    const geo = geoip.lookup(rawIp)
    country = geo?.country || 'unknown'
    city = geo?.city || null
  }

  const ua = req.headers['user-agent'] || 'unknown'
  const device_type = /mobile/i.test(ua)
    ? 'mobile'
    : /tablet|ipad/i.test(ua)
      ? 'tablet'
      : 'desktop'
  const browser = /edg/i.test(ua)
    ? 'Edge'
    : /chrome|crios/i.test(ua)
      ? 'Chrome'
      : /safari/i.test(ua)
        ? 'Safari'
        : /firefox|fxios/i.test(ua)
          ? 'Firefox'
          : 'Unknown'
  const os = /windows/i.test(ua)
    ? 'Windows'
    : /mac os|macintosh/i.test(ua)
      ? 'macOS'
      : /android/i.test(ua)
        ? 'Android'
        : /iphone|ipad|ios/i.test(ua)
          ? 'iOS'
          : 'Unknown'

  return { ip, country, city, ua, device_type, browser, os }
}

async function logVendorClick(req, {
  productId,
  uuid = 'guest',
  from = 'unknown',
  vendor = '',
  vendorId = '',
  brandName = '',
  instruction = '',
  behavior = 'vendor_exit',
}) {
  if (!productId) return

  const ctx = clientContext(req)
  const product = await Product.findById(productId).lean()
  if (!product) return

  const resolvedVendor =
    vendor ||
    product.vendor ||
    product.cheapest_vendor?.vendor ||
    ''
  const resolvedVendorId =
    vendorId ||
    product.vendor_id ||
    product.cheapest_vendor?.vendor_id ||
    ''

  const recent = await Click.findOne({
    uuid,
    product_id: productId,
    vendor_id: resolvedVendorId || undefined,
    clicked_at: { $gte: new Date(Date.now() - 3000) },
  }).lean()

  if (recent) return

  await Click.create({
    product_id: product._id,
    product_name: product.product_name,
    brand_name: brandName || product.brand_name || '',
    brand_id: product.brand_id || '',
    vendor: resolvedVendor,
    vendor_id: resolvedVendorId,
    uuid,
    source: from,
    instruction: instruction || from,
    behavior,
    referrer: req.headers.referer || req.headers.referrer || '',
    ip: ctx.ip,
    country: ctx.country,
    city: ctx.city,
    user_agent: ctx.ua,
    device_type: ctx.device_type,
    browser: ctx.browser,
    os: ctx.os,
    clicked_at: new Date(),
  })

  // Price-alert interest (vendor click ≈ purchase intent for affiliate site)
  if (uuid && uuid !== 'guest') {
    try {
      const offers = Array.isArray(product.offers) ? product.offers : []
      const prices = [
        Number(product.search_price),
        Number(product.cheapest_offer),
        ...offers.map(o => Number(o?.price)),
      ].filter(n => Number.isFinite(n) && n > 0)
      const cheapest = prices.length ? Math.min(...prices) : null
      const vendorOffer = offers.find(
        o =>
          (resolvedVendorId && o.vendor_id === resolvedVendorId) ||
          (resolvedVendor && o.vendor === resolvedVendor)
      )
      const vendorPrice = vendorOffer ? Number(vendorOffer.price) : null
      const isPurchaseCta = /angebot|kaufen|shop|purchase/i.test(
        instruction || from || ''
      )

      await ProductInterest.findOneAndUpdate(
        { uuid, productId: product._id },
        {
          $set: {
            slug: product.slug,
            productName: product.product_name,
            brandName: product.brand_name,
            dimensions: product.dimensions,
            lastPrice: cheapest,
            lastOfferCount: offers.length,
            preferredVendor: resolvedVendor,
            preferredVendorId: resolvedVendorId,
            ...(Number.isFinite(vendorPrice)
              ? { preferredVendorLastPrice: vendorPrice }
              : {}),
            clickedAt: new Date(),
            ...(isPurchaseCta ? { purchaseIntentAt: new Date() } : {}),
            notifyEnabled: true,
          },
          $addToSet: {
            sources: isPurchaseCta ? 'purchase_intent' : 'vendor_click',
          },
        },
        { upsert: true }
      )
    } catch (interestErr) {
      console.error('ProductInterest upsert failed:', interestErr)
    }
  }
}

function setExitHeaders(res) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
}

/**
 * Neutral vendor exit (adblock-resistant path name).
 * Prefer this over /out/ which EasyList often blocks.
 */
async function handleVendorExit(req, res, token) {
  const decodedUrl = affiliateCloak.decodeAffiliateUrl(token)
  if (!decodedUrl) {
    return res.status(404).send('Invalid or expired link')
  }

  const {
    product: productId,
    uuid = 'guest',
    from = 'unknown',
    vendor = '',
    vendorId = '',
    brand = '',
    instruction = '',
    behavior = 'vendor_exit',
  } = { ...req.query, ...req.body }

  try {
    await logVendorClick(req, {
      productId,
      uuid,
      from,
      vendor,
      vendorId,
      brandName: brand,
      instruction,
      behavior,
    })
  } catch (err) {
    console.error('Click logging failed:', err)
  }

  setExitHeaders(res)
  const clickRef = buildAwinClickRef({ productId, uuid, from })
  const exitUrl = appendAwinClickRef(decodedUrl, clickRef)
  return res.redirect(302, exitUrl)
}

/** Primary adblock-safe GET exit */
router.get('/r/:token', async (req, res) => {
  return handleVendorExit(req, res, req.params.token)
})

/**
 * POST exit — form submits are less often list-blocked than GET /out/...
 * Body: { t|token, product, uuid, from, vendor, vendorId, brand, instruction }
 */
router.post('/r', express.urlencoded({ extended: true }), async (req, res) => {
  const token = req.body.t || req.body.token
  if (!token) return res.status(400).send('Missing token')
  return handleVendorExit(req, res, token)
})

/** Legacy alias — keep working but prefer /r */
router.get('/out/:cloaked', async (req, res) => {
  return handleVendorExit(req, res, req.params.cloaked)
})

export default router
