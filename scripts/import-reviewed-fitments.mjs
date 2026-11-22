// Import source-reviewed records grouped by model, using the admin validator.
import '../src/loadEnv.js'
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { Vehicle, vehicleKey, validFitment, normalizeFitment } from '../src/api/fitment/data.js'

const [path, mode] = process.argv.slice(2)
if (!path || !['--check', '--apply'].includes(mode)) {
  throw new Error('Usage: node scripts/import-reviewed-fitments.mjs reviewed.json --check|--apply')
}
const catalog = JSON.parse(await readFile(path, 'utf8'))
if (!Array.isArray(catalog) || !catalog.length) throw new Error('Expected a nonempty array of models')
const keys = new Set()
let records = 0
const operations = catalog.map((row, index) => {
  const { make, model, fitments } = row || {}
  if (typeof make !== 'string' || !make.trim() || make.length > 100 ||
      typeof model !== 'string' || !model.trim() || model.length > 100 ||
      !Array.isArray(fitments) || !fitments.length || !fitments.every(validFitment)) {
    throw new Error(`Invalid model or fitment at row ${index + 1}`)
  }
  const key = vehicleKey(make, model)
  if (keys.has(key) || key.startsWith(':') || key.endsWith(':')) throw new Error(`Invalid or duplicate model key: ${key}`)
  keys.add(key)
  records += fitments.length
  return { updateOne: {
    filter: { key },
    update: {
      $setOnInsert: { make: make.trim(), model: model.trim() },
      $set: { reviewed: true },
      $addToSet: { fitments: { $each: fitments.map(normalizeFitment) } },
    },
    upsert: true,
  } }
})

if (mode === '--apply') {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
  await mongoose.connect(process.env.MONGODB_URI)
  try {
    await Vehicle.init()
    await Vehicle.bulkWrite(operations)
  } finally {
    await mongoose.disconnect()
  }
}
console.log(JSON.stringify({ mode, models: keys.size, records }))
