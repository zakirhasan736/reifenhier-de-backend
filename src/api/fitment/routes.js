import { Router } from 'express'
import { createHash, randomBytes } from 'node:crypto'
import { isIP } from 'node:net'
import ipaddr from 'ipaddr.js'
import { rateLimit } from 'express-rate-limit'
import { adminAuth } from '../../middleware/auth.js'
import { Access, Vehicle, normalizeSize, normalizeFitment, validFitment, plans, termsVersion, vehicleKey, AI_SOURCE_PREFIX } from './data.js'
import { withData, modelsForSize, recomputeRanks, saveAiFitments, cleanFitments } from './service.js'
import { aiModelFitments } from './ai.js'
import { openApiSpec } from './openapi.js'
import { sendAutoApiRequest } from '../utils/gmailMailer.js'
import { appendAutoApiRequest } from '../utils/googleSheetLeads.js'

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
const projection = 'make model key fitments reviewed -_id'
const GRACE_MS = 7 * 864e5
const str = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Only accept an ingress-supplied address when the immediate peer is explicitly
// configured and overwrites this header. A direct connection uses its socket.
function sourceIp(req) {
  const peer = ip(req.socket.remoteAddress)
  if (peer && peer === ip(process.env.FITMENT_TRUSTED_PROXY_IP)) {
    return ip(req.get('x-fitment-client-ip'), true)
  }
  return ip(peer, true)
}

function requestIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  const raw = req.headers['cf-connecting-ip']
    || req.headers['x-real-ip']
    || (typeof forwarded === 'string' ? forwarded.split(',')[0] : '')
    || req.socket?.remoteAddress
    || ''
  return ip(String(raw).trim()) || String(raw).trim().slice(0, 64)
}

function applicationIp(value) {
  let input = typeof value === 'string' ? value.trim() : ''
  input = input.replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
  const withPort = input.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/)
  if (withPort) input = withPort[1]
  const bracketed = input.match(/^\[([^\]]+)\](?::\d{1,5})?$/)
  if (bracketed) input = bracketed[1]
  const publicAddress = ip(input, true)
  if (publicAddress) return { address: publicAddress }
  return { field: ip(input) ? 'private_ip' : 'ips' }
}

function rejectApplication(res, field) {
  return res.status(400).json({ error: 'invalid_application', field })
}

router.get('/plans', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json({ plans, termsVersion, currency: 'EUR', net: true })
})
router.get('/openapi.json', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=300')
  res.json(openApiSpec())
})
// Numbers for the API pricing page
let statsCache = null
router.get('/stats', handle(async (_req, res) => {
  if (!statsCache || Date.now() - statsCache.at > 30 * 60000) {
    const [models, reviewed, agg, sizes] = await Promise.all([
      Vehicle.countDocuments(withData),
      Vehicle.countDocuments({ ...withData, reviewed: true }),
      Vehicle.aggregate([{ $match: withData }, { $project: { n: { $size: '$fitments' }, v: { $size: { $setUnion: ['$fitments.variant', []] } } } }, { $group: { _id: null, records: { $sum: '$n' }, variants: { $sum: '$v' } } }]),
      Vehicle.distinct('fitments.size'),
    ])
    statsCache = { at: Date.now(), data: { models, reviewed, variants: agg[0]?.variants || 0, records: agg[0]?.records || 0, sizes: sizes.length } }
  }
  res.set('Cache-Control', 'public, max-age=1800')
  res.json(statsCache.data)
}))
router.post('/access', rateLimit({ limit: 20, windowMs: 3600000 }), handle(async (req, res) => {
  const { plan, email, ips, acceptedTerms } = req.body || {}
  const body = req.body || {}
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : ''
  const tokens = (Array.isArray(ips) ? ips : [])
    .flatMap(value => String(value).split(/[\s,;]+/))
    .map(value => value.trim())
    .filter(Boolean)
  if (!isPlan(plan)) return rejectApplication(res, 'plan')
  if (!normalizedEmail || normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return rejectApplication(res, 'email')
  }
  if (acceptedTerms !== termsVersion) return rejectApplication(res, 'terms')
  const billingData = {
    billing: body.billing === 'yearly' ? 'yearly' : 'monthly',
    company: str(body.company), name: str(body.name), street: str(body.street), zip: str(body.zip, 12),
    city: str(body.city, 80), country: str(body.country, 2).toUpperCase() || 'DE',
    vatId: str(body.vatId, 20).toUpperCase().replace(/\s/g, ''), website: str(body.website), useCase: str(body.useCase, 1000),
  }
  if (!billingData.name) return rejectApplication(res, 'name')
  // Paid plans are invoiced: company and billing address are required.
  if (plans[plan].price > 0) {
    if (!billingData.company) return rejectApplication(res, 'company')
    if (!billingData.street || !billingData.zip || !billingData.city) return rejectApplication(res, 'address')
  }
  if (!tokens.length) return rejectApplication(res, 'ips')
  if (tokens.length > plans[plan].ips) return rejectApplication(res, 'too_many_ips')
  const parsed = tokens.map(applicationIp)
  const invalid = parsed.find(item => item.field)
  if (invalid) return rejectApplication(res, invalid.field)
  const requestedIps = [...new Set(parsed.map(item => item.address))]
  const requesterIp = requestIp(req)
  await Access.create({
    plan,
    email: normalizedEmail,
    requestedIps,
    requestIp: requesterIp,
    termsVersion,
    ...billingData,
  })

  try {
    await sendAutoApiRequest({
      email: normalizedEmail,
      plan,
      serverIps: requestedIps,
      ip: requesterIp,
    })
  } catch (err) {
    console.error('[AUTO-API MAIL]', err.message)
  }

  try {
    await appendAutoApiRequest({
      email: normalizedEmail,
      plan,
      serverIps: requestedIps,
      ip: requesterIp,
      status: 'pending',
    })
  } catch (err) {
    console.error('[AUTO-API SHEET]', err.message)
  }

  res.status(202).json({ status: 'pending' })
}))

// "Passt z. B. auf" box on product and size pages (reviewed + AI records, flagged)
router.get('/examples', handle(async (req, res) => {
  const limit = Math.min(12, Math.max(1, Number(req.query.limit) || 5))
  const found = await modelsForSize(req.query.size, { limit })
  if (!found) return res.status(400).json({ error: 'invalid_size' })
  res.set('Cache-Control', 'public, max-age=1800')
  res.json({
    size: found.size,
    total: found.total,
    vehicles: found.rows.map(row => ({
      make: row.make, model: row.model, verified: Boolean(row.reviewed),
      fitments: row.fitments.filter(record => record.size === found.size).slice(0, 2)
        .map(({ variant, yearFrom, yearTo, axle }) => ({ variant, yearFrom, yearTo, axle })),
    })),
  })
}))

router.get('/v1/vehicles', handle(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const token = req.get('authorization')?.match(/^Bearer (rfx_[a-f0-9]{64})$/)
  const account = token && await Access.findOne({ keyHash: hash(token[1]), status: 'active' }).lean()
  if (!account) return res.status(401).json({ error: 'invalid_key' })
  if (!account.requestedIps.includes(sourceIp(req))) return res.status(403).json({ error: 'ip_not_allowed' })

  const { size, make, model, year } = req.query
  const modelYear = year === undefined ? undefined : Number(year)
  const normalized = size === undefined ? undefined : normalizeSize(size)
  const offset = Number(req.query.offset ?? 0)
  const limit = Number(req.query.limit ?? 25)
  if (normalized === null || !Number.isSafeInteger(offset) || offset < 0 ||
      !Number.isInteger(limit) || limit < 1 || limit > 100 ||
      [make, model].some(value => value !== undefined && (typeof value !== 'string' || value.length > 100)) ||
      (year !== undefined && (typeof year !== 'string' || !/^\d{4}$/.test(year) ||
        modelYear < 1950 || modelYear > new Date().getUTCFullYear() + 1)) ||
      (model && !make)) return res.status(400).json({ error: 'invalid_query' })

  const plan = plans[account.plan]
  if (normalized && !plan.bySize) return res.status(403).json({ error: 'plan_upgrade_required', message: 'Suche nach Reifengröße ist in Pro und Advanced enthalten.' })
  if (plan.price > 0 && account.paidUntil && new Date(account.paidUntil).getTime() + GRACE_MS < Date.now()) {
    return res.status(402).json({ error: 'payment_required' })
  }
  const today = new Date().toISOString().slice(0, 10)
  const used = await Access.findOneAndUpdate({
    _id: account._id, status: 'active', keyHash: hash(token[1]),
    $or: [{ usageDate: { $ne: today } }, { requests: { $lt: plan.daily } }],
  }, [{ $set: { requests: { $cond: [{ $eq: ['$usageDate', today] }, { $add: ['$requests', 1] }, 1] }, usageDate: today, lastUsedAt: '$$NOW' } }],
  { new: true, projection: { requests: 1 } })
  if (!used) return res.status(429).json({ error: 'access_changed_or_daily_limit' })
  res.set('X-RateLimit-Limit', String(plan.daily))
  res.set('X-RateLimit-Remaining', String(Math.max(0, plan.daily - used.requests)))

  const filter = { ...withData, ...(plan.models ? { rank: { $lte: plan.models } } : {}) }
  const [brand, name] = vehicleKey(make, model).split(':')
  if (brand && name) filter.key = { $in: [`${brand}:${name}`, `${brand}:${name.replace(/\d+$/, '')}`] }
  else if (brand) filter.key = { $regex: `^${brand.replace(/[^a-z0-9]/g, '')}:` }
  if (normalized || modelYear !== undefined) {
    filter.fitments = { $elemMatch: {
      ...(normalized ? { size: normalized } : {}),
      ...(modelYear !== undefined ? { yearFrom: { $lte: modelYear }, yearTo: { $gte: modelYear } } : {}),
    } }
  }
  const [rows, total] = await Promise.all([
    Vehicle.find(filter).select(projection).sort({ rank: 1, key: 1 }).skip(offset).limit(limit).lean(),
    Vehicle.countDocuments(filter),
  ])
  const vehicles = rows.map(({ reviewed, fitments, ...row }) => ({
    ...row,
    verified: Boolean(reviewed),
    fitments: fitments
      .filter(record => (!normalized || record.size === normalized) &&
        (modelYear === undefined || (record.yearFrom <= modelYear && record.yearTo >= modelYear)))
      .map(({ loadIndex, speedIndex, source, ...record }) => ({
        ...record,
        ...(plan.indexes ? { loadIndex: loadIndex || null, speedIndex: speedIndex || null } : {}),
        source: source.startsWith(AI_SOURCE_PREFIX) ? 'reifexa (KI, ungeprüft)' : source,
      })),
  }))
  res.json({ vehicles, total, offset, limit, plan: account.plan })
}))

router.get('/v1/usage', handle(async (req, res) => {
  res.set('Cache-Control', 'no-store')
  const token = req.get('authorization')?.match(/^Bearer (rfx_[a-f0-9]{64})$/)
  const account = token && await Access.findOne({ keyHash: hash(token[1]), status: 'active' }).lean()
  if (!account) return res.status(401).json({ error: 'invalid_key' })
  if (!account.requestedIps.includes(sourceIp(req))) return res.status(403).json({ error: 'ip_not_allowed' })
  const plan = plans[account.plan]
  const today = new Date().toISOString().slice(0, 10)
  const usedToday = account.usageDate === today ? account.requests : 0
  res.json({
    plan: account.plan, daily: plan.daily, usedToday, remainingToday: Math.max(0, plan.daily - usedToday),
    models: plan.models, allowedIps: account.requestedIps, paidUntil: account.paidUntil || null,
  })
}))

adminRouter.use(adminAuth, (_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
const esc = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// GET /vehicles?q=golf&status=ai|reviewed|empty|failed|visitor&size=205/55 R16&offset=0
adminRouter.get('/vehicles', handle(async (req, res) => {
  const offset = Number(req.query.offset || 0)
  if (!Number.isSafeInteger(offset) || offset < 0) return res.status(400).json({ error: 'invalid_offset' })
  const filter = {}
  const q = str(req.query.q, 60)
  if (q) {
    // "golf" → any key containing golf; "vw golf" → vw:…golf…
    const words = q.split(/\s+/)
    const part = value => vehicleKey('x', value).split(':')[1]
    const all = part(q)
    filter.$or = [{ key: { $regex: esc(all) } }]
    if (words.length > 1) {
      const brand = vehicleKey(words[0], 'x').split(':')[0]
      filter.$or.push({ key: { $regex: `^${esc(brand)}:.*${esc(part(words.slice(1).join(' ')))}` } })
    }
  }
  const size = req.query.size ? normalizeSize(String(req.query.size)) : null
  if (size) filter['fitments.size'] = size
  const status = String(req.query.status || '')
  if (status === 'reviewed') filter.reviewed = true
  if (status === 'ai') Object.assign(filter, { reviewed: { $ne: true }, ...withData })
  if (status === 'empty') Object.assign(filter, { 'fitments.0': { $exists: false } })
  if (status === 'failed') filter['ai.status'] = 'failed'
  if (status === 'visitor') filter['ai.origin'] = 'visitor'
  const [items, total] = await Promise.all([
    Vehicle.find(filter).sort({ rank: 1, key: 1 }).skip(offset).limit(25).lean(),
    Vehicle.countDocuments(filter),
  ])
  res.json({ items, total, offset })
}))
adminRouter.get('/stats', handle(async (_req, res) => {
  const [models, withSizes, reviewed, failed, visitors, pending, active] = await Promise.all([
    Vehicle.countDocuments(), Vehicle.countDocuments(withData), Vehicle.countDocuments({ ...withData, reviewed: true }),
    Vehicle.countDocuments({ 'ai.status': 'failed' }), Vehicle.countDocuments({ 'ai.origin': 'visitor' }),
    Access.countDocuments({ status: 'pending' }), Access.countDocuments({ status: 'active' }),
  ])
  res.json({ models, withSizes, reviewed, unreviewed: withSizes - reviewed, failed, visitors, pending, active })
}))
// Mark the current records as checked (no changes)
adminRouter.post('/vehicles/:id/approve', handle(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' })
  const row = await Vehicle.findOne({ _id: req.params.id })
  if (!row?.fitments?.length) return res.status(404).json({ error: 'no_fitments' })
  row.fitments = row.fitments.map(record => ({
    ...record.toObject(),
    source: record.source.startsWith(AI_SOURCE_PREFIX) ? `Geprüft von Reifexa (${new Date().toISOString().slice(0, 10)})` : record.source,
  }))
  row.reviewed = true
  await row.save()
  res.json(row)
}))
// Ask the AI again for one model (not for reviewed models)
adminRouter.post('/vehicles/:id/ai', handle(async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ai_not_configured' })
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' })
  const row = await Vehicle.findById(req.params.id).lean()
  if (!row) return res.status(404).json({ error: 'not_found' })
  if (row.reviewed) return res.status(409).json({ error: 'reviewed' })
  const result = await aiModelFitments(row.make, row.model)
  const count = await saveAiFitments({ _id: row._id }, result.fitments)
  res.json({ count, vehicle: await Vehicle.findById(row._id).lean() })
}))
adminRouter.post('/vehicles/rank', handle(async (_req, res) => res.json({ ranked: await recomputeRanks() })))
adminRouter.post('/vehicles', handle(async (req, res) => {
  const { make, model } = req.body || {}
  const key = vehicleKey(make, model)
  if (!str(make) || !str(model) || key.startsWith(':') || key.endsWith(':')) return res.status(400).json({ error: 'invalid_model' })
  const fitments = cleanFitments(req.body.fitments)
  const row = await Vehicle.findOneAndUpdate({ key }, { $setOnInsert: { key, make: str(make, 100), model: str(model, 100) } }, { upsert: true, new: true })
  if (fitments.length) {
    row.fitments = fitments
    row.reviewed = true
    await row.save()
  }
  res.status(201).json(row)
}))
adminRouter.put('/vehicles/:id', handle(async (req, res) => {
  const records = req.body?.fitments
  if (!/^[a-f0-9]{24}$/i.test(req.params.id) || !Array.isArray(records) || records.length > 100 ||
      !records.every(validFitment)) {
    return res.status(400).json({ error: 'invalid_fitments' })
  }
  const fitments = records.map(normalizeFitment)
  const row = await Vehicle.findByIdAndUpdate(req.params.id, { fitments, reviewed: true }, { new: true, runValidators: true })
  res.status(row ? 200 : 404).json(row || { error: 'not_found' })
}))
adminRouter.get('/access', handle(async (_req, res) => {
  res.json(await Access.find().sort({ createdAt: -1 }).limit(200).lean())
}))
// Change plan, allowed server IPs, paid-until date or note of an application/customer
adminRouter.patch('/access/:id', handle(async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) return res.status(400).json({ error: 'invalid_id' })
  const row = await Access.findById(req.params.id)
  if (!row) return res.status(404).json({ error: 'not_found' })
  const b = req.body || {}
  if (b.plan !== undefined) {
    if (!isPlan(b.plan)) return res.status(400).json({ error: 'invalid_plan' })
    row.plan = b.plan
  }
  if (b.ips !== undefined) {
    const tokens = (Array.isArray(b.ips) ? b.ips : String(b.ips).split(/[\s,;]+/)).map(v => String(v).trim()).filter(Boolean)
    const parsed = tokens.map(applicationIp)
    if (!tokens.length || parsed.some(item => item.field)) return res.status(400).json({ error: 'invalid_ips' })
    if (tokens.length > plans[row.plan].ips) return res.status(400).json({ error: 'too_many_ips' })
    row.requestedIps = [...new Set(parsed.map(item => item.address))]
  }
  if (b.paidUntil !== undefined) row.paidUntil = b.paidUntil ? new Date(b.paidUntil) : undefined
  if (typeof b.adminNote === 'string') row.adminNote = b.adminNote.slice(0, 1000)
  await row.save()
  res.json(row)
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
  const pending = await Access.findOne({ _id: id, status: 'pending' }).lean()
  let paidUntil = pending?.paidUntil
  if (pending && !paidUntil && plans[pending.plan]?.price > 0) {
    paidUntil = new Date()
    if (pending.billing === 'yearly') paidUntil.setUTCFullYear(paidUntil.getUTCFullYear() + 1)
    else paidUntil.setUTCMonth(paidUntil.getUTCMonth() + 1)
  }
  const row = await Access.findOneAndUpdate({ _id: id, status: 'pending' },
    { status: 'active', keyHash: hash(key), ...(paidUntil ? { paidUntil } : {}) })
  res.status(row ? 200 : 404).json(row ? { key } : { error: 'not_found' })
}))
