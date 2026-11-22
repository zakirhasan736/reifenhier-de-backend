import { Router } from 'express'
import mongoose from 'mongoose'
import { rateLimit } from 'express-rate-limit'
import { adminAuth } from '../../middleware/auth.js'

const Review = mongoose.model('SiteReview', new mongoose.Schema({
  kind: { type: String, enum: ['bug', 'satisfaction'], required: true },
  rating: { type: Number, min: 1, max: 5, required: true },
  message: { type: String, required: true, maxlength: 2000 },
  published: { type: Boolean, default: false },
}, { timestamps: true }))
Review.schema.index({ createdAt: -1 })

export const reviewRoutes = Router()
export const reviewAdminRoutes = Router()
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)

reviewRoutes.get('/summary', handle(async (_req, res) => {
  const [summary] = await Review.aggregate([
    { $match: { kind: 'satisfaction', published: true } },
    { $group: { _id: null, count: { $sum: 1 }, average: { $avg: '$rating' } } },
    { $project: { _id: 0, count: 1, average: 1 } },
  ])
  res.set('Cache-Control', 'public, max-age=60').json(summary || { count: 0, average: null })
}))

reviewRoutes.post('/', rateLimit({ limit: 10, windowMs: 3600000 }), handle(async (req, res) => {
  const { kind, rating, message } = req.body || {}
  if (!['bug', 'satisfaction'].includes(kind) || !Number.isInteger(rating) ||
      rating < 1 || rating > 5 || typeof message !== 'string' || !message.trim() || message.length > 2000) {
    return res.status(400).json({ error: 'invalid_review' })
  }
  await Review.create({ kind, rating, message: message.trim() })
  res.status(201).json({ received: true })
}))

reviewAdminRoutes.use(adminAuth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
reviewAdminRoutes.get('/', handle(async (req, res) => {
  const offset = Number(req.query.offset ?? 0)
  if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: 'invalid_offset' })
  res.json(await Review.find().sort({ createdAt: -1, _id: -1 }).skip(offset).limit(50).lean())
}))
reviewAdminRoutes.patch('/:id', handle(async (req, res) => {
  const { published } = req.body || {}
  if (!mongoose.isObjectIdOrHexString(req.params.id) || typeof published !== 'boolean') {
    return res.status(400).json({ error: 'invalid_review' })
  }
  const updated = await Review.findOneAndUpdate(
    { _id: req.params.id, kind: 'satisfaction' }, { published }, { new: true },
  ).lean()
  res.status(updated ? 200 : 404).json(updated || { error: 'not_found' })
}))
