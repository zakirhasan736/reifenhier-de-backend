import PushSubscription from '../../models/pushSubscription.js'
import ProductInterest from '../../models/productInterest.js'
import Product from '../../models/product.js'
import { getVapidPublicKey, sendPushToUuid } from './push.service.js'
import { sendWelcomePush } from '../utils/pushCampaignCron.js'

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

/** GET /api/push/vapid-public-key */
export async function getPublicKey(_req, res) {
  const key = getVapidPublicKey()
  if (!key) {
    return res.status(503).json({ error: 'push_not_configured' })
  }
  return res.json({ publicKey: key })
}

/** POST /api/push/subscribe  { uuid, subscription } */
export async function subscribe(req, res) {
  try {
    const uuid = req.body.uuid || req.cookies?.uuid
    const subscription = req.body.subscription
    if (!uuid || uuid === 'guest') {
      return res.status(400).json({ error: 'missing_uuid' })
    }
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'invalid_subscription' })
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          uuid,
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
          userAgent: req.headers['user-agent'] || '',
          enabled: true,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, new: true }
    )

    // Welcome + first offers push (async, don't block response)
    setTimeout(() => {
      sendWelcomePush(uuid).catch(err =>
        console.error('[PUSH] welcome failed:', err)
      )
    }, 1500)

    return res.json({ success: true })
  } catch (err) {
    console.error('[PUSH] subscribe failed:', err)
    return res.status(500).json({ error: 'subscribe_failed' })
  }
}

/** POST /api/push/unsubscribe { uuid, endpoint? } */
export async function unsubscribe(req, res) {
  try {
    const uuid = req.body.uuid || req.cookies?.uuid
    const endpoint = req.body.endpoint
    if (!uuid) return res.status(400).json({ error: 'missing_uuid' })

    if (endpoint) {
      await PushSubscription.deleteOne({ uuid, endpoint })
    } else {
      await PushSubscription.updateMany({ uuid }, { $set: { enabled: false } })
    }
    return res.json({ success: true })
  } catch (err) {
    console.error('[PUSH] unsubscribe failed:', err)
    return res.status(500).json({ error: 'unsubscribe_failed' })
  }
}

/**
 * POST /api/push/interest
 * Track product view / vendor click / purchase intent for price alerts.
 */
export async function trackInterest(req, res) {
  try {
    const {
      uuid,
      productId,
      source = 'view',
      vendor = '',
      vendorId = '',
      vendorPrice,
      notifyEnabled,
    } = req.body

    if (!uuid || uuid === 'guest' || !productId) {
      return res.status(400).json({ error: 'missing_uuid_or_product' })
    }

    const product = await Product.findById(productId)
      .select(
        'slug product_name brand_name dimensions search_price cheapest_offer offers vendor cheapest_vendor'
      )
      .lean()

    if (!product) {
      return res.status(404).json({ error: 'product_not_found' })
    }

    const price = currentCheapest(product)
    const vendorPrices = snapshotVendorPrices(product)
    const preferredVendorPrice = Number.isFinite(Number(vendorPrice))
      ? Number(vendorPrice)
      : vendorPrices.find(
          v =>
            (vendorId && v.vendor_id === vendorId) ||
            (vendor && v.vendor === vendor)
        )?.price ?? null

    const now = new Date()
    const setFields = {
      slug: product.slug,
      productName: product.product_name,
      brandName: product.brand_name,
      dimensions: product.dimensions,
      lastPrice: price,
      lastVendorPrices: vendorPrices,
      lastOfferCount: vendorPrices.length,
      notifyEnabled:
        typeof notifyEnabled === 'boolean' ? notifyEnabled : true,
    }

    if (source === 'view') setFields.viewedAt = now
    if (source === 'vendor_click') {
      setFields.clickedAt = now
      setFields.preferredVendor = vendor || product.cheapest_vendor?.vendor || ''
      setFields.preferredVendorId =
        vendorId || product.cheapest_vendor?.vendor_id || ''
      if (preferredVendorPrice != null) {
        setFields.preferredVendorLastPrice = preferredVendorPrice
      }
    }
    if (source === 'purchase_intent') {
      setFields.purchaseIntentAt = now
      setFields.clickedAt = now
      if (vendor) setFields.preferredVendor = vendor
      if (vendorId) setFields.preferredVendorId = vendorId
      if (preferredVendorPrice != null) {
        setFields.preferredVendorLastPrice = preferredVendorPrice
      }
    }

    await ProductInterest.findOneAndUpdate(
      { uuid, productId },
      {
        $set: setFields,
        $addToSet: { sources: source },
      },
      { upsert: true, new: true }
    )

    return res.json({ success: true, price })
  } catch (err) {
    console.error('[PUSH] trackInterest failed:', err)
    return res.status(500).json({ error: 'track_failed' })
  }
}

/** GET /api/push/status?uuid= */
export async function status(req, res) {
  try {
    const uuid = req.query.uuid || req.cookies?.uuid
    if (!uuid || uuid === 'guest') {
      return res.json({ subscribed: false, interests: 0 })
    }
    const [subCount, interestCount] = await Promise.all([
      PushSubscription.countDocuments({ uuid, enabled: true }),
      ProductInterest.countDocuments({ uuid, notifyEnabled: true }),
    ])
    return res.json({
      subscribed: subCount > 0,
      interests: interestCount,
      vapidConfigured: Boolean(getVapidPublicKey()),
    })
  } catch (err) {
    return res.status(500).json({ error: 'status_failed' })
  }
}

/** POST /api/push/test — optional debug (protected by env flag) */
export async function testPush(req, res) {
  if (process.env.PUSH_TEST_ENABLED !== 'true') {
    return res.status(403).json({ error: 'disabled' })
  }
  const uuid = req.body.uuid || req.cookies?.uuid
  const result = await sendPushToUuid(uuid, {
    title: 'Reifexa Preisalarm',
    body: 'Test: Push-Benachrichtigungen funktionieren.',
    url: 'https://www.reifexa.de/',
    tag: 'reifexa-test',
  })
  return res.json(result)
}
