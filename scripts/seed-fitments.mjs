import '../src/loadEnv.js'
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { Vehicle, normalizeSize, vehicleKey } from '../src/api/fitment/data.js'
import { llmAvailable, llmJson } from '../src/api/searchlight/llm.js'

const [path, mode, rawLimit] = process.argv.slice(2)
if (!path || !['--catalogue', '--suggest'].includes(mode)) {
  throw new Error('Usage: node scripts/seed-fitments.mjs catalogue.json --catalogue|--suggest [limit]')
}
if (mode === '--suggest' && !llmAvailable()) throw new Error('Configure a Searchlight model and key')
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
const limit = Number(rawLimit || 300)
if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Limit must be a positive integer')
const catalogue = JSON.parse(await readFile(path, 'utf8'))
const targets = Object.entries(catalogue).flatMap(([make, models]) =>
  models.map(model => ({ make, model, key: vehicleKey(make, model) })))
const unique = [...new Map(targets.map(row => [row.key, row])).values()].slice(0, limit)

await mongoose.connect(process.env.MONGODB_URI)
try {
  await Vehicle.init()
  let suggested = 0
  let failed = 0
  let unavailable = 0
  for (const row of unique) {
    await Vehicle.updateOne({ key: row.key }, { $setOnInsert: row }, { upsert: true })
    if (mode !== '--suggest') continue
    const existing = await Vehicle.findOne({ key: row.key }).lean()
    if (existing.reviewed || existing.candidates.length) continue
    const output = await llmJson({
      system: 'Return JSON only. Suggest common original equipment tyre sizes on German-market variants. These candidates will be independently reviewed. Omit uncertain sizes.',
      prompt: JSON.stringify({ make: row.make, model: row.model, format: { sizes: ['205/55 R16'] }, maxSizes: 8 }),
      maxTokens: 350,
    })
    unavailable = output === null ? unavailable + 1 : 0
    if (unavailable >= 5) throw new Error('Five consecutive provider failures. Check the configured model, key and network, then resume.')
    const candidates = (Array.isArray(output?.sizes) ? output.sizes : []).map(normalizeSize).filter(Boolean).slice(0, 8)
    if (!candidates.length) {
      failed++
      continue
    }
    await Vehicle.updateOne({ key: row.key, reviewed: false }, { $addToSet: { candidates: { $each: candidates } } })
    suggested++
  }
  console.log(JSON.stringify({ targeted: unique.length, suggested, withoutSuggestions: failed }))
} finally {
  await mongoose.disconnect()
}
