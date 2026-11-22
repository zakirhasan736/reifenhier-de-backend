import { Router } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import { rateLimit } from 'express-rate-limit'
import { adminAuth } from '../../middleware/auth.js'
import { Access, Vehicle, normalizeSize, plans, termsVersion, vehicleKey } from './data.js'

export const router = Router()
export const adminRouter = Router()
const handle = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const hash = key => createHash('sha256').update(key).digest('hex')
function ip(value, publicOnly = false) {
  const input = typeof value === 'string' ? value.trim() : ''
  if (input.includes('%') || !isIP(input)) return ''
  const address = ipaddr.process(input)
  return !publicOnly || address.range() === 'unicast' ? address.toString() : ''
}
const isPlan = value => typeof value === 'string' && Object.hasOwn(plans, value)
const catalogue = { reviewed: true, 'fitments.0': { $exists: true } }
const projection = 'make model key fitments -_id'

// Only accept an ingress-supplied address when the immediate peer is explicitly
// configured and overwrites this header. A direct connection uses its socket.
function sourceIp(req) {
  const peer = ip(req.socket.remoteAddress)
  if (peer && peer === ip(process.env.FITMENT_TRUSTED_PROXY_IP)) {
    return ip(req.get('x-fitment-client-ip'), true)
  }
  return ip(peer, true)
}

router.get('/plans', (_req, res) => res.json({ plans, termsVersion }))
router.post('/access', rateLimit({ limit: 20, windowMs: 3600000 }), handle(async (req, res) => {
  const { plan, email, ips, acceptedTerms } = req.body || {}
  if (!isPlan(plan) || typeof email !== 'string' || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || acceptedTerms !== termsVersion ||
      !Array.isArray(ips) || !ips.length || ips.length > plans[plan].ips ||
      ips.some(value => !ip(value, true))) {
    return res.status(400).json({ error: 'invalid_application' })
  }
  await Access.create({ plan, email: email.toLowerCase(), requestedIps: [...new Set(ips.map(value => ip(value, true)))], termsVersion })
  res.status(202).json({ status: 'pending' })
}))

router.get('/examples', handle(async (req, res) => {
  const size = normalizeSize(req.query.size)
  if (!size) return res.status(400).json({ error: 'invalid_size' })
  const rows = await Vehicle.find({ ...catalogue, 'fitments.size': size })
    .select(projection).sort({ key: 1 }).limit(5).lean()
  res.json({ vehicles: rows.map(row => ({
    make: row.make, model: row.model,
    fitments: row.fitments.filter(record => record.size === size).slice(0, 2)
      .map(({ variant, yearFrom, yearTo, axle }) => ({ variant, yearFrom, yearTo, axle })),
  })) })
}))

router.get('/v1/vehicles', handle(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const token = req.get('authorization')?.match(/^Bearer (rfx_[a-f0-9]{64})$/)
  const account = token && await Access.findOne({ keyHash: hash(token[1]), status: 'active' }).lean()
  if (!account) return res.status(401).json({ error: 'invalid_key' })
  if (!account.requestedIps.includes(sourceIp(req))) return res.status(403).json({ error: 'ip_not_allowed' })

  const { size, make, model } = req.query
  const normalized = size === undefined ? undefined : normalizeSize(size)
  const offset = Number(req.query.offset ?? 0)
  const limit = Number(req.query.limit ?? 25)
  if (normalized === null || !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      [make, model].some(value => value !== undefined && (typeof value !== 'string' || value.length > 100)) ||
      (model && !make)) return res.status(400).json({ error: 'invalid_query' })

  const plan = plans[account.plan]
  const today = new Date().toISOString().slice(0, 10)
  const used = await Access.findOneAndUpdate({
    _id: account._id, status: 'active', keyHash: hash(token[1]),
    $or: [{ usageDate: { $ne: today } }, { requests: { $lt: plan.daily } }],
  }, [{ $set: { requests: { $cond: [{ $eq: ['$usageDate', today] }, { $add: ['$requests', 1] }, 1] }, usageDate: today } }])
  if (!used) return res.status(429).json({ error: 'access_changed_or_daily_limit' })

  const rows = await Vehicle.find(catalogue).select(projection).sort({ _id: 1 }).limit(plan.models).lean()
  const [brand, name] = vehicleKey(make, model).split(':')
  const matches = rows.filter(row => (!brand || row.key.startsWith(`${brand}:`)) && (!name || row.key === `${brand}:${name}`))
    .map(row => ({ ...row, fitments: normalized ? row.fitments.filter(record => record.size === normalized) : row.fitments }))
    .filter(row => row.fitments.length)
  res.json({ vehicles: matches.slice(offset, offset + limit), total: matches.length, offset, limit })
}))

adminRouter.use(adminAuth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
adminRouter.get('/vehicles', handle(async (req, res) => {
  const offset = Number(req.query.offset || 0)
  if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: 'invalid_offset' })
  res.json(await Vehicle.find().sort({ key: 1 }).skip(offset).limit(25).lean())
}))
adminRouter.put('/vehicles/:id', handle(async (req, res) => {
  const records = req.body?.fitments
  if (!/^[a-f0-9]{24}$/i.test(req.params.id) || !Array.isArray(records) || records.length > 100 ||
      records.some(record => !record || !normalizeSize(record.size) ||
        typeof record.variant !== 'string' || !record.variant.trim() || record.variant.length > 160 ||
        !Number.isInteger(record.yearFrom) || !Number.isInteger(record.yearTo) ||
        record.yearFrom < 1950 || record.yearTo > new Date().getUTCFullYear() + 1 || record.yearFrom > record.yearTo ||
        !['front', 'rear', 'both'].includes(record.axle) || typeof record.source !== 'string' ||
        !record.source.trim() || record.source.length > 500)) {
    return res.status(400).json({ error: 'invalid_fitments' })
  }
  const fitments = records.map(({ size, variant, yearFrom, yearTo, axle, source }) =>
    ({ size: normalizeSize(size), variant: variant.trim(), yearFrom, yearTo, axle, source: source.trim() }))
  const row = await Vehicle.findByIdAndUpdate(req.params.id, { fitments, reviewed: true }, { new: true, runValidators: true })
  res.status(row ? 200 : 404).json(row || { error: 'not_found' })
}))
adminRouter.get('/access', handle(async (_req, res) => {
  res.json(await Access.find().sort({ createdAt: -1 }).limit(100).lean())
}))
adminRouter.post('/access/:id/:action', handle(async (req, res) => {
  const { id, action } = req.params
  if (!/^[a-f0-9]{24}$/i.test(id) || !['activate', 'revoke'].includes(action)) {
    return res.status(400).json({ error: 'invalid_action' })
  }
  if (action === 'revoke') {
    const row = await Access.findByIdAndUpdate(id, { $set: { status: 'revoked' }, $unset: { keyHash: 1 } })
    return res.status(row ? 200 : 404).json({ status: row ? 'revoked' : 'not_found' })
  }
  const key = `rfx_${randomBytes(32).toString('hex')}`
  const row = await Access.findOneAndUpdate({ _id: id, status: 'pending' },
    { status: 'active', keyHash: hash(key) })
  res.status(row ? 200 : 404).json(row ? { key } : { error: 'not_found' })
}))
