import express from 'express'
import crypto from 'crypto'
import { recommend, productCheck, readTyrePhoto, carSizes } from './searchlight.service.js'
import { llmAvailable } from './llm.js'

const router = express.Router()

// Per-visitor limiter (AI calls cost money): 40 requests / 10 min, photos 8 / 10 min.
const buckets = new Map()
function limit(name, max) {
  return (req, res, next) => {
    const ip = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim()
    const key = `${name}:${crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16)}`
    const now = Date.now()
    const b = buckets.get(key) || { n: 0, t: now }
    if (now - b.t > 600000) {
      b.n = 0
      b.t = now
    }
    b.n += 1
    buckets.set(key, b)
    if (buckets.size > 50000) buckets.clear()
    if (b.n > max) return res.status(429).json({ error: 'too_many_requests', message: 'Bitte einen Moment warten und erneut versuchen.' })
    next()
  }
}

const wrap = fn => async (req, res) => {
  try {
    await fn(req, res)
  } catch (err) {
    console.error('[searchlight]', req.path, err?.message || err)
    res.status(500).json({ error: 'searchlight_failed', message: 'Da ist etwas schiefgelaufen. Bitte versuche es erneut.' })
  }
}

router.get('/status', (_req, res) => res.json({ ai: llmAvailable(), carData: Boolean(process.env.WHEEL_SIZE_API_KEY) }))

router.post('/recommend', limit('rec', 40), wrap(async (req, res) => res.json(await recommend(req.body || {}))))

router.post('/product-check', limit('rec', 40), wrap(async (req, res) => {
  const out = await productCheck(req.body?.slug)
  if (!out) return res.status(404).json({ error: 'not_found' })
  res.json(out)
}))

router.post('/car', limit('car', 20), wrap(async (req, res) => {
  const out = await carSizes(req.body || {})
  res.status(out.error ? 422 : 200).json(out)
}))

router.post('/photo', limit('photo', 8), wrap(async (req, res) => {
  const out = await readTyrePhoto(req.body?.image)
  res.status(out.error ? 422 : 200).json(out)
}))

export default router
