import '../src/loadEnv.js'
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { Vehicle, vehicleKey } from '../src/api/fitment/data.js'

const [path, mode, rawLimit] = process.argv.slice(2)
if (!path || mode !== '--catalogue') {
  throw new Error('Usage: node scripts/seed-fitments.mjs catalogue.json --catalogue [limit]')
}
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
  for (const row of unique) {
    await Vehicle.updateOne({ key: row.key }, { $setOnInsert: row }, { upsert: true })
  }
  console.log(JSON.stringify({ targeted: unique.length }))
} finally {
  await mongoose.disconnect()
}
