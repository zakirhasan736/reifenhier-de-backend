import webpush from 'web-push'
import PushSubscription from '../../models/pushSubscription.js'

let configured = false

function ensureVapid() {
  if (configured) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:info@reifexa.de'
  if (!publicKey || !privateKey) {
    console.warn('[PUSH] VAPID keys missing — push disabled')
    return false
  }
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || ''
}

/**
 * Send a web push to one browser subscription.
 * Removes dead endpoints (410/404).
 */
export async function sendPushToSubscription(subDoc, payload) {
  if (!ensureVapid()) return { ok: false, reason: 'no_vapid' }

  const subscription = {
    endpoint: subDoc.endpoint,
    keys: {
      p256dh: subDoc.keys.p256dh,
      auth: subDoc.keys.auth,
    },
  }

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 60 * 60 * 12,
      urgency: 'normal',
    })
    return { ok: true }
  } catch (err) {
    const status = err?.statusCode
    if (status === 404 || status === 410) {
      await PushSubscription.deleteOne({ endpoint: subDoc.endpoint })
      return { ok: false, reason: 'gone' }
    }
    console.error('[PUSH] send failed:', err?.message || err)
    return { ok: false, reason: 'send_failed' }
  }
}

/** Fan-out to all enabled subscriptions for a uuid */
export async function sendPushToUuid(uuid, payload) {
  if (!uuid || uuid === 'guest') return { sent: 0 }
  const subs = await PushSubscription.find({ uuid, enabled: true }).lean()
  let sent = 0
  for (const sub of subs) {
    const result = await sendPushToSubscription(sub, payload)
    if (result.ok) sent += 1
  }
  return { sent, total: subs.length }
}

export default {
  getVapidPublicKey,
  sendPushToSubscription,
  sendPushToUuid,
  ensureVapid,
}
