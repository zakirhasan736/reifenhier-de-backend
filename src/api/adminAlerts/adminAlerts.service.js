/**
 * Owner alerts: web-push to the site owner's own devices when
 *   1) AWIN records a sale (webhook or API poll)  → "💰 Neuer Verkauf"
 *   2) a visitor clicks out to a shop              → "🛒 Klick zu <Shop>"
 *   3) an AWIN sale changes status (approved/declined)
 *
 * Clicks are what WE see. Sales are what AWIN sees. Comparing the two is
 * how you find out whether tracking is broken or shoppers just didn't buy.
 */
import AdminPushSubscription from '../../models/adminPushSubscription.js'
import AwinTransaction from '../../models/awinTransaction.js'
import Click from '../../models/click.js'
import { sendPushToSubscription } from '../push/push.service.js'

const SITE_URL = (process.env.FRONTEND_URL || 'https://www.reifexa.de').replace(/\/$/, '')
const ALERTS_PAGE = `${SITE_URL}/admin-alerts`

function money(n, currency = 'EUR') {
  const v = Number(n)
  if (!Number.isFinite(v)) return '–'
  try {
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currency || 'EUR' }).format(v)
  } catch {
    return `${v.toFixed(2)} ${currency || ''}`.trim()
  }
}

/** Fan-out to every enabled owner device that opted into this kind. */
export async function sendAdminPush(kind, payload) {
  const filter = { enabled: true }
  if (kind === 'sale') filter.notifySales = true
  if (kind === 'click') filter.notifyClicks = true

  const subs = await AdminPushSubscription.find(filter).lean()
  let sent = 0
  for (const sub of subs) {
    // push.service deletes gone endpoints from the customer collection only,
    // so clean ours up here too.
    const r = await sendPushToSubscription(sub, {
      icon: `${SITE_URL}/images/favicon.png`,
      badge: `${SITE_URL}/images/favicon.png`,
      url: ALERTS_PAGE,
      ...payload,
    })
    if (r.ok) sent += 1
    else if (r.reason === 'gone') {
      await AdminPushSubscription.deleteOne({ endpoint: sub.endpoint }).catch(() => {})
    }
  }
  return { sent, total: subs.length }
}

// ── Click-out alerts ─────────────────────────────────────────────────────

/**
 * Called after a real (human) vendor click is logged.
 * ADMIN_CLICK_ALERTS=off disables; default on.
 */
export async function notifyVendorClick({ productName, vendor, price, source, isAwinLink, merchantId }) {
  if (String(process.env.ADMIN_CLICK_ALERTS || 'on').toLowerCase() === 'off') return
  const warn = isAwinLink ? '' : '⚠️ KEIN AWIN-Link – Verkauf wird NICHT getrackt! '
  return sendAdminPush('click', {
    title: `🛒 Klick zu ${vendor || 'Shop'}${isAwinLink ? '' : ' ⚠️'}`,
    body: `${warn}${productName || 'Produkt'}${price ? ` · ${money(price)}` : ''}${source ? ` · ${source}` : ''}${merchantId ? ` · m=${merchantId}` : ''}`,
    tag: `rx-click-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: 'admin_click',
  })
}

// ── AWIN transactions ────────────────────────────────────────────────────

/** clickref we build: rx-<last12 of productId>-<source> */
function productHintFromClickRef(ref) {
  const m = /^rx-([\w]+)-/.exec(String(ref || ''))
  return m ? m[1] : ''
}

async function merchantNameFor(merchantId) {
  if (!merchantId) return ''
  const c = await Click.findOne({ awin_merchant_id: String(merchantId) })
    .sort({ clicked_at: -1 })
    .select('vendor')
    .lean()
    .catch(() => null)
  return c?.vendor || ''
}

/**
 * Normalised tx: { transactionId, merchantId, saleAmount, commission, currency,
 *                  status, clickRef, clickRefs, transactionDate, clickDate, raw }
 * Upserts; pushes on first sight and on status change to approved/declined.
 */
export async function recordAwinTransaction(tx, source, { silent = false } = {}) {
  if (!tx?.transactionId) return { stored: false }
  const now = new Date()
  const existing = await AwinTransaction.findOne({ transactionId: tx.transactionId }).lean()

  const merchantName = existing?.merchantName || (await merchantNameFor(tx.merchantId))
  const doc = {
    ...tx,
    merchantName,
    productId: productHintFromClickRef(tx.clickRef),
    updatedAt: now,
  }
  // Webhook is first and has no status; don't overwrite a real status with blank.
  if (!doc.status && existing?.status) doc.status = existing.status

  await AwinTransaction.updateOne(
    { transactionId: tx.transactionId },
    { $set: doc, $setOnInsert: { createdAt: now, source } },
    { upsert: true }
  )

  const shop = merchantName || `Händler ${tx.merchantId || '?'}`
  if (!existing) {
    if (silent) return { stored: true, isNew: true }
    await sendAdminPush('sale', {
      title: `💰 Neuer Verkauf bei ${shop}`,
      body: `Umsatz ${money(tx.saleAmount, tx.currency)} · Provision ${money(tx.commission, tx.currency)}${tx.clickRef ? ` · ${tx.clickRef}` : ''}`,
      tag: `rx-sale-${tx.transactionId}`,
      kind: 'admin_sale',
    })
    await AwinTransaction.updateOne({ transactionId: tx.transactionId }, { $set: { notifiedAt: new Date() } })
    return { stored: true, isNew: true }
  }

  const newStatus = String(tx.status || '').toLowerCase()
  const oldStatus = String(existing.status || '').toLowerCase()
  if (!silent && newStatus && newStatus !== oldStatus && ['approved', 'declined'].includes(newStatus)) {
    await sendAdminPush('sale', {
      title: newStatus === 'approved' ? `✅ Provision bestätigt – ${shop}` : `❌ Verkauf storniert – ${shop}`,
      body: `Provision ${money(tx.commission ?? existing.commission, tx.currency || existing.currency)} · Transaktion ${tx.transactionId}`,
      tag: `rx-sale-status-${tx.transactionId}`,
      kind: 'admin_sale_status',
    })
    await AwinTransaction.updateOne({ transactionId: tx.transactionId }, { $set: { statusNotifiedAt: new Date() } })
  }
  return { stored: true, isNew: false }
}

const num = v => {
  const n = Number(String(v ?? '').replace(',', '.'))
  return Number.isFinite(n) ? n : undefined
}
const date = v => {
  if (!v) return undefined
  const d = /^\d+$/.test(String(v)) ? new Date(Number(v) * (String(v).length <= 10 ? 1000 : 1)) : new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

/** AWIN "Transaction Notifications" payload (POST JSON or GET params). */
export function normaliseWebhookTx(p = {}) {
  return {
    transactionId: String(p.transactionId || p.id || ''),
    merchantId: p.merchantId != null ? String(p.merchantId) : p.advertiserId != null ? String(p.advertiserId) : '',
    saleAmount: num(p.transactionAmount ?? p.saleAmount ?? p.amount),
    commission: num(p.commission ?? p.commissionAmount),
    currency: p.transactionCurrency || p.currency || 'EUR',
    status: p.status || p.commissionStatus || '',
    clickRef: p.clickRef || p.clickref || '',
    clickRefs: {
      clickRef: p.clickRef || p.clickref || '',
      clickRef2: p.clickRef2 || p.clickref2 || '',
      clickRef3: p.clickRef3 || p.clickref3 || '',
      clickRef5: p.clickRef5 || p.clickref5 || '',
    },
    transactionDate: date(p.transactionDate),
    clickDate: date(p.clickTime || p.clickDate),
    raw: p,
  }
}

/** AWIN Publisher API /transactions item. */
export function normaliseApiTx(t = {}) {
  const refs = t.clickRefs || {}
  return {
    transactionId: String(t.id || ''),
    merchantId: t.advertiserId != null ? String(t.advertiserId) : '',
    saleAmount: num(t.saleAmount?.amount),
    commission: num(t.commissionAmount?.amount),
    currency: t.saleAmount?.currency || t.commissionAmount?.currency || 'EUR',
    status: t.commissionStatus || '',
    clickRef: refs.clickRef || '',
    clickRefs: refs,
    transactionDate: date(t.transactionDate),
    clickDate: date(t.clickDate),
    raw: t,
  }
}

// ── Summary for the owner page ───────────────────────────────────────────

export async function getAlertsSummary(days = 7) {
  const since = new Date(Date.now() - days * 86400000)
  const [clicksByVendor, txs, subs] = await Promise.all([
    Click.aggregate([
      { $match: { clicked_at: { $gte: since } } },
      {
        $group: {
          _id: { vendor: '$vendor', merchant: '$awin_merchant_id' },
          clicks: { $sum: 1 },
          awinLinks: { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$awin_affiliate_id', ''] } }, 0] }, 1, 0] } },
          last: { $max: '$clicked_at' },
        },
      },
      { $sort: { clicks: -1 } },
      { $limit: 40 },
    ]),
    AwinTransaction.find({ $or: [{ transactionDate: { $gte: since } }, { createdAt: { $gte: since } }] })
      .sort({ transactionDate: -1, createdAt: -1 })
      .limit(100)
      .select('-raw')
      .lean(),
    AdminPushSubscription.countDocuments({ enabled: true }),
  ])

  const salesByMerchant = {}
  for (const t of txs) salesByMerchant[t.merchantId] = (salesByMerchant[t.merchantId] || 0) + 1

  return {
    days,
    devices: subs,
    totals: {
      clicks: clicksByVendor.reduce((a, r) => a + r.clicks, 0),
      nonAwinClicks: clicksByVendor.reduce((a, r) => a + (r.clicks - r.awinLinks), 0),
      sales: txs.length,
      commission: txs.reduce((a, t) => a + (t.status === 'declined' ? 0 : t.commission || 0), 0),
    },
    vendors: clicksByVendor.map(r => ({
      vendor: r._id.vendor || '(unbekannt)',
      merchantId: r._id.merchant || '',
      clicks: r.clicks,
      nonAwinClicks: r.clicks - r.awinLinks,
      sales: salesByMerchant[r._id.merchant] || 0,
      lastClick: r.last,
    })),
    transactions: txs,
    pollerConfigured: Boolean(process.env.AWIN_API_TOKEN && (process.env.AWIN_PUBLISHER_ID || process.env.AWIN_AFFILIATE_ID)),
    webhookConfigured: Boolean(process.env.AWIN_WEBHOOK_SECRET),
  }
}
