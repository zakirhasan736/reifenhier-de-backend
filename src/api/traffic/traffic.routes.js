import express from 'express'
import crypto from 'crypto'
import TrafficVisit from '../../models/trafficVisit.js'
import Click from '../../models/click.js'
import Product from '../../models/product.js'
import { classifySource } from './classifySource.js'
import { isTrackingBot } from '../utils/awinTracking.js'

const router = express.Router()

const clip = (v, n) => String(v || '').slice(0, n)

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''))
  const y = Buffer.from(String(b || ''))
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y)
}
function requireOwner(req, res, next) {
  const expected = process.env.ADMIN_ALERT_KEY
  if (!expected) return res.status(503).json({ error: 'ADMIN_ALERT_KEY not set on server' })
  if (!safeEqual(req.headers['x-admin-alert-key'], expected)) return res.status(401).json({ error: 'unauthorized' })
  next()
}

// Tiny in-memory limiter for the public beacon (per anonymised client, 60/min).
const hits = new Map()
function limited(req) {
  const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '')
    .split(',')[0]
    .trim()
  const key = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)
  const now = Date.now()
  const h = hits.get(key) || { n: 0, t: now }
  if (now - h.t > 60000) {
    h.n = 0
    h.t = now
  }
  h.n += 1
  hits.set(key, h)
  if (hits.size > 50000) hits.clear()
  return h.n > 60
}

function deviceOf(ua) {
  if (/ipad|tablet/i.test(ua)) return 'tablet'
  if (/mobi|android|iphone/i.test(ua)) return 'mobile'
  return 'desktop'
}

/**
 * POST /api/traffic/visit — first page of a session.
 * Body: { referrer, landing, utm_source, utm_medium, utm_campaign }
 * Returns { channel, source } so the page can tag later shop clicks.
 */
router.post('/visit', async (req, res) => {
  const ua = String(req.headers['user-agent'] || '')
  const b = req.body && typeof req.body === 'object' ? req.body : {}
  const c = classifySource({ referrer: clip(b.referrer, 500), utmSource: clip(b.utm_source, 80), utmMedium: clip(b.utm_medium, 80) })
  if (isTrackingBot(ua) || limited(req) || c.channel === 'internal') return res.json({ channel: c.channel, source: c.source, stored: false })
  let landingPath = ''
  try {
    landingPath = new URL(clip(b.landing, 500), 'https://www.reifexa.de').pathname.slice(0, 200)
  } catch {
    /* ignore */
  }
  const slug = /^\/produkte\/([^/?#]+)/.exec(landingPath)?.[1] || ''
  TrafficVisit.create({
    ...c,
    utmSource: clip(b.utm_source, 80),
    utmMedium: clip(b.utm_medium, 80),
    utmCampaign: clip(b.utm_campaign, 120),
    landingPath,
    productSlug: slug,
    device: deviceOf(ua),
  }).catch(err => console.error('[traffic] visit not stored:', err?.message || err))
  res.json({ channel: c.channel, source: c.source, stored: true })
})

/** GET /api/traffic/summary?days=30 — owner only */
router.get('/summary', requireOwner, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365)
  const since = new Date(Date.now() - days * 86400000)
  try {
    const [bySource, byDay, aiLanding, aiProducts, recentAi, clicksBySource, total] = await Promise.all([
      TrafficVisit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { channel: '$channel', source: '$source' }, visits: { $sum: 1 }, last: { $max: '$createdAt' } } },
        { $sort: { visits: -1 } },
      ]),
      TrafficVisit.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Europe/Berlin' } }, ch: '$channel' },
            n: { $sum: 1 },
          },
        },
        { $sort: { '_id.d': 1 } },
      ]),
      TrafficVisit.aggregate([
        { $match: { createdAt: { $gte: since }, channel: 'ai' } },
        { $group: { _id: { path: '$landingPath', source: '$source' }, visits: { $sum: 1 } } },
        { $sort: { visits: -1 } },
        { $limit: 30 },
      ]),
      TrafficVisit.aggregate([
        { $match: { createdAt: { $gte: since }, channel: 'ai', productSlug: { $nin: [null, ''] } } },
        { $group: { _id: '$productSlug', visits: { $sum: 1 }, sources: { $addToSet: '$source' } } },
        { $sort: { visits: -1 } },
        { $limit: 20 },
      ]),
      TrafficVisit.find({ createdAt: { $gte: since }, channel: 'ai' }).sort({ createdAt: -1 }).limit(40).lean(),
      Click.aggregate([
        { $match: { clicked_at: { $gte: since }, behavior: { $in: [null, 'vendor_exit'] } } },
        { $group: { _id: { $ifNull: ['$traffic_source', ''] }, clicks: { $sum: 1 } } },
      ]),
      TrafficVisit.countDocuments({ createdAt: { $gte: since } }),
    ])

    const clicksBy = Object.fromEntries(clicksBySource.map(c => [c._id, c.clicks]))
    const sources = bySource.map(s => ({
      channel: s._id.channel,
      source: s._id.source,
      visits: s.visits,
      shopClicks: clicksBy[s._id.source] || 0,
      clickRatePct: s.visits ? Math.round(((clicksBy[s._id.source] || 0) / s.visits) * 1000) / 10 : 0,
      last: s.last,
    }))
    const channels = {}
    for (const s of sources) {
      const c = (channels[s.channel] ||= { channel: s.channel, visits: 0, shopClicks: 0 })
      c.visits += s.visits
      c.shopClicks += s.shopClicks
    }
    const days_ = {}
    for (const d of byDay) (days_[d._id.d] ||= { date: d._id.d })[d._id.ch] = d.n

    const slugs = aiProducts.map(p => p._id)
    const names = Object.fromEntries(
      (await Product.find({ slug: { $in: slugs } }).select('slug product_name brand_name').lean()).map(p => [
        p.slug,
        [p.brand_name, p.product_name].filter(Boolean).join(' '),
      ])
    )

    res.json({
      days,
      totalVisits: total,
      untaggedShopClicks: clicksBy[''] || 0,
      channels: Object.values(channels).sort((a, b) => b.visits - a.visits),
      sources,
      daily: Object.values(days_),
      ai: {
        visits: channels.ai?.visits || 0,
        shopClicks: channels.ai?.shopClicks || 0,
        topLandingPages: aiLanding.map(a => ({ path: a._id.path, source: a._id.source, visits: a.visits })),
        topProducts: aiProducts.map(p => ({ slug: p._id, name: names[p._id] || p._id, visits: p.visits, sources: p.sources })),
        recent: recentAi.map(v => ({ at: v.createdAt, source: v.source, landingPath: v.landingPath, device: v.device })),
      },
    })
  } catch (err) {
    console.error('[traffic] summary failed:', err?.message || err)
    res.status(500).json({ error: 'traffic_summary_failed' })
  }
})

export default router
