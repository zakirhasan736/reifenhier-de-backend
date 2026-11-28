// Must load env before importing app (ESM import order)
import './loadEnv.js'
// Sentry first, so errors from start-up on are reported (no-op without SENTRY_DSN)
import { Sentry } from './instrument.js'
import app from './app.js'
import { connectDB } from './config/db.js'
import { ensureLeadTabs } from './api/utils/googleSheetLeads.js'
import { ensureTempAdmin } from './api/ops/ensureTempAdmin.js'

const PORT = Number(process.env.PORT) || 8004
const HOST = process.env.HOST || '127.0.0.1'

connectDB()
  .then((ok) => { if (ok) return ensureTempAdmin() })
  .catch((err) => {
    console.error('❌ MongoDB bootstrap failed:', err?.message || err)
    Sentry.captureException(err)
  })

// Promise errors nobody awaited: log and report instead of losing them.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason?.message || reason)
  Sentry.captureException(reason)
})

const server = app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`)
  ensureLeadTabs().catch((err) => console.error('[SHEET]', err?.message || err))
})

server.on('error', (err) => {
  console.error(`❌ Failed to bind ${HOST}:${PORT}:`, err.message)
  process.exit(1)
})
