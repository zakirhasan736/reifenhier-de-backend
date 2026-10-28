import express from 'express'
import crypto from 'crypto'
import AdminPushSubscription from '../../models/adminPushSubscription.js'
import {
  sendAdminPush,
  recordAwinTransaction,
  normaliseWebhookTx,
  getAlertsSummary,
} from './adminAlerts.service.js'
import { getVapidPublicKey } from '../push/push.service.js'

const router = express.Router()

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''))
  const y = Buffer.from(String(b || ''))
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** Owner-only: header x-admin-alert-key must equal ADMIN_ALERT_KEY. */
function requireOwner(req, res, next) {
  const expected = process.env.ADMIN_ALERT_KEY
  if (!expected) return res.status(503).json({ error: 'ADMIN_ALERT_KEY not set on server' })
  if (!safeEqual(req.headers['x-admin-alert-key'], expected)) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  next()
}

/** GET /api/admin-alerts/vapid-public-key */
router.get('/vapid-public-key', (_req, res) => {
  const key = getVapidPublicKey()
  if (!key) return res.status(503).json({ error: 'push_not_configured' })
  res.json({ publicKey: key })
})

/** POST /api/admin-alerts/subscribe { subscription, label, notifySales, notifyClicks } */
router.post('/subscribe', requireOwner, async (req, res) => {
  const { subscription, label = '', notifySales = true, notifyClicks = true } = req.body || {}
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'invalid_subscription' })
  }
  await AdminPushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
        label: String(label).slice(0, 60),
        userAgent: req.headers['user-agent'] || '',
        notifySales: Boolean(notifySales),
        notifyClicks: Boolean(notifyClicks),
        enabled: true,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  )
  res.json({ success: true })
})

/** POST /api/admin-alerts/unsubscribe { endpoint } */
router.post('/unsubscribe', requireOwner, async (req, res) => {
  const endpoint = req.body?.endpoint
  if (!endpoint) return res.status(400).json({ error: 'missing_endpoint' })
  await AdminPushSubscription.deleteOne({ endpoint })
  res.json({ success: true })
})

/** POST /api/admin-alerts/test — sends a test push to every owner device */
router.post('/test', requireOwner, async (_req, res) => {
  const r = await sendAdminPush('test', {
    title: '🔔 Reifexa Test-Benachrichtigung',
    body: 'Push funktioniert. Sie werden bei Verkäufen und Klicks benachrichtigt.',
    tag: `rx-test-${Date.now()}`,
    kind: 'admin_test',
  })
  res.json(r)
})

/** GET /api/admin-alerts/summary?days=7 */
router.get('/summary', requireOwner, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 90)
  res.json(await getAlertsSummary(days))
})

/**
 * AWIN Transaction Notifications callback (Awin → Toolbox → Transaction Notifications).
 * URL: https://api.reifexa.de/api/admin-alerts/awin-webhook/<AWIN_WEBHOOK_SECRET>
 * POST: form field "AwinTransactionPush" holding JSON (Awin's format), or raw JSON.
 * GET : placeholders as query params (transactionId, commission, …).
 */
async function awinWebhook(req, res) {
  if (!process.env.AWIN_WEBHOOK_SECRET || !safeEqual(req.params.secret, process.env.AWIN_WEBHOOK_SECRET)) {
    return res.status(404).end()
  }

  let payload = {}
  try {
    if (req.method === 'GET') {
      payload = req.query
    } else if (req.body?.AwinTransactionPush) {
      const v = req.body.AwinTransactionPush
      payload = typeof v === 'string' ? JSON.parse(v) : v
    } else {
      payload = req.body || {}
    }
  } catch (err) {
    console.error('[AWIN webhook] bad payload:', err?.message)
    return res.status(200).json({ ok: false }) // 200 so Awin doesn't hammer retries
  }

  const list = Array.isArray(payload) ? payload : [payload]
  let stored = 0
  for (const p of list) {
    const tx = normaliseWebhookTx(p)
    if (!tx.transactionId) continue
    try {
      const r = await recordAwinTransaction(tx, 'webhook')
      if (r.stored) stored += 1
    } catch (err) {
      console.error('[AWIN webhook] store failed:', err?.message)
    }
  }
  console.log(`[AWIN webhook] received ${list.length}, stored ${stored}`)
  res.status(200).json({ ok: true, stored })
}

router.post(
  '/awin-webhook/:secret',
  express.urlencoded({ extended: true, limit: '1mb' }),
  express.text({ type: 'text/*', limit: '1mb' }),
  (req, _res, next) => {
    if (typeof req.body === 'string') {
      try { req.body = JSON.parse(req.body) } catch { req.body = {} }
    }
    next()
  },
  awinWebhook
)
router.get('/awin-webhook/:secret', awinWebhook)

export default router
