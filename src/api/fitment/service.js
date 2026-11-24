import { Vehicle, vehicleKey, validFitment, normalizeFitment, normalizeSize } from './data.js'
import { aiOneCar, fitmentModel } from './ai.js'
import { makeWeight } from './makes.js'

/** Validate + normalise + de-duplicate fitment records (invalid ones are dropped). */
export function cleanFitments(records = []) {
  const seen = new Set()
  const out = []
  for (const r of Array.isArray(records) ? records : []) {
    if (!validFitment(r)) continue
    const f = normalizeFitment(r)
    const k = `${f.size}|${f.variant}|${f.axle}`
    if (seen.has(k)) continue
    seen.add(k)
    out.push(f)
  }
  return out.slice(0, 100)
}

/** Store AI records on a model — never touches a model an admin reviewed. */
export async function saveAiFitments(filter, records, extra = {}) {
  const fitments = cleanFitments(records)
  const set = fitments.length
    ? { fitments, 'ai.status': 'filled', 'ai.model': fitmentModel(), 'ai.at': new Date(), 'ai.error': null, ...extra }
    : { 'ai.status': 'failed', 'ai.error': 'no valid sizes', 'ai.at': new Date(), ...extra }
  await Vehicle.updateOne({ ...filter, reviewed: { $ne: true } }, { $set: set, $inc: { 'ai.attempts': 1 } })
  return fitments.length
}

/** rank 1..N over all models with data: make weight × popularity. */
export async function recomputeRanks() {
  const rows = await Vehicle.aggregate([
    { $project: { key: 1, popularity: 1, reviewed: 1, has: { $gt: [{ $size: { $ifNull: ['$fitments', []] } }, 0] } } },
  ])
  // models with tyre sizes first, so "top 50" in a plan are 50 usable models
  const score = (v) => (v.has ? 1e6 : 0) + makeWeight(v.key.split(':')[0]) * (v.popularity || 30) * (v.reviewed ? 1.05 : 1)
  rows.sort((a, b) => score(b) - score(a) || a.key.localeCompare(b.key))
  const ops = rows.map((v, i) => ({ updateOne: { filter: { _id: v._id }, update: { $set: { rank: i + 1 } } } }))
  for (let i = 0; i < ops.length; i += 1000) await Vehicle.bulkWrite(ops.slice(i, i + 1000), { ordered: false })
  return rows.length
}

/** Models that have data (reviewed or AI-filled). */
export const withData = { 'fitments.0': { $exists: true } }
export const isVerified = (row) => Boolean(row?.reviewed)

/** "VW" + "Golf 7" → vw:golf7, then vw:golf (generation number typed). */
export async function findModel(make, model) {
  const key = vehicleKey(make, model)
  const [brand, name] = key.split(':')
  if (!brand || !name) return null
  const exact = await Vehicle.findOne({ key, ...withData }).lean()
  if (exact) return exact
  const stripped = name.replace(/\d+$/, '')
  if (stripped && stripped !== name) {
    const base = await Vehicle.findOne({ key: `${brand}:${stripped}`, ...withData }).lean()
    if (base) return base
  }
  return null
}

export function fitmentsForYear(row, year) {
  const y = Number(year) || 0
  return (row?.fitments || []).filter((f) => !y || (f.yearFrom <= y && f.yearTo >= y))
}

/**
 * Searchlight: our table first; a car we do not know is asked to the AI once
 * and saved as KI-Vorschlag (the database grows with every new car).
 */
export async function visitorLookup(make, model, year) {
  const found = await findModel(make, model)
  if (found) return found
  if (!process.env.ANTHROPIC_API_KEY) return null
  let ai = null
  try {
    ai = await aiOneCar(make, model)
  } catch (err) {
    console.error('[fitment] visitor AI failed:', err?.message || err)
    return null
  }
  const fitments = cleanFitments(ai?.fitments)
  if (!ai || !fitments.length) return null
  const key = vehicleKey(ai.make, ai.model)
  if (key.startsWith(':') || key.endsWith(':')) return null
  const existing = await Vehicle.findOne({ key }).lean()
  if (existing?.fitments?.length) return existing // AI named a model we already have
  await Vehicle.updateOne(
    { key },
    { $setOnInsert: { key, make: ai.make, model: ai.model, popularity: 20, 'ai.origin': 'visitor' } },
    { upsert: true }
  )
  await saveAiFitments({ key }, fitments)
  return Vehicle.findOne({ key }).lean()
}

/** Which models use this size? Most common first. */
export async function modelsForSize(rawSize, { limit = 12, maxRank } = {}) {
  const size = normalizeSize(rawSize)
  if (!size) return null
  const filter = { 'fitments.size': size, ...(maxRank ? { rank: { $lte: maxRank } } : {}) }
  const [rows, total] = await Promise.all([
    Vehicle.find(filter).select('make model key fitments reviewed rank -_id').sort({ rank: 1 }).limit(limit).lean(),
    Vehicle.countDocuments(filter),
  ])
  return { size, total, rows }
}
