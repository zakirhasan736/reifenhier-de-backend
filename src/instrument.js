// Sentry error tracking for the API and the cron worker.
// Import this file FIRST (before express and the app) so errors are captured from start-up.
// Without SENTRY_DSN in .env it does nothing, so local runs and tests stay offline.
import './loadEnv.js'
import * as Sentry from '@sentry/node'

const dsn = (process.env.SENTRY_DSN || '').trim()

/** Drop request data we must not send (cookies, auth headers, e-mail addresses). */
export function scrubEvent(event) {
  const req = event.request
  if (req) {
    delete req.cookies
    if (req.headers) {
      for (const h of ['cookie', 'authorization', 'x-api-key']) delete req.headers[h]
    }
    if (typeof req.data === 'string') req.data = req.data.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
  }
  if (event.user) event.user = { id: event.user.id }
  return event
}

export const sentryEnabled = Boolean(dsn) && process.env.NODE_ENV !== 'test'

if (sentryEnabled && !globalThis.__reifexaSentry) {
  globalThis.__reifexaSentry = true
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || undefined,
    // Errors only by default; set SENTRY_TRACES_SAMPLE_RATE=0.05 to also sample slow requests.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0),
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    ignoreErrors: [
      // Visitors closing the tab mid-request – not a bug.
      'ECONNRESET',
      'EPIPE',
      'request aborted',
    ],
  })
  console.log('[sentry] error tracking on')
}

export { Sentry }
