/**
 * Polls the AWIN Publisher API for transactions and pushes new sales /
 * status changes to the owner's devices.
 *
 * Env:
 *   AWIN_API_TOKEN          OAuth token from https://ui.awin.com/awin-api
 *   AWIN_PUBLISHER_ID       (falls back to AWIN_AFFILIATE_ID) e.g. 2985775
 *   AWIN_POLL_MINUTES       default 10
 *   AWIN_POLL_LOOKBACK_DAYS default 3
 */
import cron from 'node-cron'
import { recordAwinTransaction, normaliseApiTx } from './adminAlerts.service.js'
import AwinTransaction from '../../models/awinTransaction.js'

const API = 'https://api.awin.com'

function fmt(d) {
  // AWIN wants yyyy-MM-ddThh:mm:ss (no ms, no Z) with timezone param
  return d.toISOString().slice(0, 19)
}

async function fetchTransactions({ publisherId, token, start, end, dateType }) {
  const url = new URL(`${API}/publishers/${publisherId}/transactions/`)
  url.searchParams.set('startDate', fmt(start))
  url.searchParams.set('endDate', fmt(end))
  url.searchParams.set('timezone', 'UTC')
  url.searchParams.set('dateType', dateType)

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
  if (res.status === 429) throw new Error('AWIN rate limited (429)')
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AWIN API ${res.status}: ${text.slice(0, 200)}`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

let running = false

export async function pollAwinTransactionsOnce() {
  const token = process.env.AWIN_API_TOKEN
  const publisherId = process.env.AWIN_PUBLISHER_ID || process.env.AWIN_AFFILIATE_ID
  if (!token || !publisherId) return { skipped: 'not_configured' }
  if (running) return { skipped: 'already_running' }
  running = true

  const lookbackDays = Math.min(Number(process.env.AWIN_POLL_LOOKBACK_DAYS || 3), 30)
  const end = new Date()
  const start = new Date(end.getTime() - lookbackDays * 86400000)
  let seen = 0
  let fresh = 0
  try {
    // Very first run: import history silently so you don't get 30 pushes at once.
    const silent = (await AwinTransaction.estimatedDocumentCount()) === 0
    // 'transaction' finds new sales; 'validation' finds approvals/declines.
    for (const dateType of ['transaction', 'validation']) {
      const list = await fetchTransactions({ publisherId, token, start, end, dateType })
      for (const t of list) {
        const tx = normaliseApiTx(t)
        if (!tx.transactionId) continue
        seen += 1
        const r = await recordAwinTransaction(tx, 'api', { silent })
        if (r.isNew) fresh += 1
      }
    }
    if (fresh) console.log(`[AWIN poll] ${fresh} new transaction(s) (${seen} seen)`)
    return { seen, fresh }
  } catch (err) {
    console.error('[AWIN poll] failed:', err?.message || err)
    return { error: err?.message }
  } finally {
    running = false
  }
}

export function startAwinTransactionPoller() {
  if (!process.env.AWIN_API_TOKEN) {
    console.warn('[AWIN poll] AWIN_API_TOKEN missing — sale polling disabled (webhook still works)')
    return
  }
  const minutes = Math.max(5, Number(process.env.AWIN_POLL_MINUTES || 10))
  cron.schedule(`*/${minutes} * * * *`, () => {
    pollAwinTransactionsOnce().catch(() => {})
  })
  // First run shortly after boot
  setTimeout(() => pollAwinTransactionsOnce().catch(() => {}), 15000)
  console.log(`[AWIN poll] every ${minutes} min`)
}
