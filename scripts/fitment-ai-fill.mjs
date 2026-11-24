#!/usr/bin/env node
/**
 * Fill Reifexa's vehicle → tyre-size database with the Anthropic API.
 * Stop (Ctrl+C) and start again at any time — it continues where it stopped.
 *
 *   node scripts/fitment-ai-fill.mjs                    # all steps (see below)
 *   node scripts/fitment-ai-fill.mjs --status           # what is in the database
 *   node scripts/fitment-ai-fill.mjs --step fill --limit 20   # try 20 models first
 *   node scripts/fitment-ai-fill.mjs --make BMW         # one make only
 *   node scripts/fitment-ai-fill.mjs --step fill        # one step: catalogue | models | fill | rank
 *   node scripts/fitment-ai-fill.mjs --retry-failed     # ask again for models that got no sizes
 *   node scripts/fitment-ai-fill.mjs --from-year 1995   # older generations too (default 2000)
 *
 * Steps
 *   1 catalogue  load scripts/fitment-models-de.json (866 model names, 64 makes)
 *   2 models     ask the AI for every model of each make sold in Germany (adds missing
 *                models, estimates how common each one is)
 *   3 fill       per model: all generations with build years + factory tyre sizes
 *                (most common models first)
 *   4 rank       1 = most common model in Germany (plans give access to the top N)
 *
 * Records are stored as "KI-Vorschlag … bitte prüfen" and the model stays
 * "not reviewed" until an admin checks it on /admin-fitment. Reviewed models
 * are never changed by this script.
 *
 * Env: ANTHROPIC_API_KEY, MONGODB_URI, FITMENT_MODEL (default claude-haiku-5-5),
 *      FITMENT_CONCURRENCY (default 4), FITMENT_PRICE_IN / FITMENT_PRICE_OUT
 *      (USD per million tokens, only for the cost line).
 */
import '../src/loadEnv.js'
import { readFile } from 'node:fs/promises'
import mongoose from 'mongoose'
import { Vehicle, vehicleKey } from '../src/api/fitment/data.js'
import { aiModelsForMake, aiModelFitments, usage, fitmentModel } from '../src/api/fitment/ai.js'
import { saveAiFitments, recomputeRanks } from '../src/api/fitment/service.js'
import { makeWeight } from '../src/api/fitment/makes.js'

const args = process.argv.slice(2)
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const has = (k) => args.includes(k)
const STEP = arg('--step', 'all')
const ONLY = arg('--make', '')
const LIMIT = Number(arg('--limit', 0)) || Infinity
const FROM_YEAR = Number(arg('--from-year', 2000))
const CONCURRENCY = Math.max(1, Number(process.env.FITMENT_CONCURRENCY || 4))
const PRICE_IN = Number(process.env.FITMENT_PRICE_IN || 1)
const PRICE_OUT = Number(process.env.FITMENT_PRICE_OUT || 5)
const CATALOGUE = new URL('./fitment-models-de.json', import.meta.url)

let stopping = false
process.on('SIGINT', () => {
  if (stopping) process.exit(1)
  stopping = true
  console.log('\n⏸  Stopping after the running calls (Ctrl+C again = quit now). Start again to continue.')
})
const budget = () => !stopping && usage.calls + usage.failed < LIMIT
const cost = () => ((usage.input * PRICE_IN + usage.output * PRICE_OUT) / 1e6).toFixed(2)
const line = () => `AI calls ${usage.calls} (failed ${usage.failed}) · tokens ${usage.input.toLocaleString('de-DE')} in / ${usage.output.toLocaleString('de-DE')} out · ~$${cost()}`
const brandOf = (make) => vehicleKey(make, 'x').split(':')[0]
const onlyBrand = ONLY ? brandOf(ONLY) : ''

async function pool(items, fn) {
  let i = 0
  const worker = async () => {
    while (i < items.length && budget()) await fn(items[i++])
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
}

async function upsertModel(make, model, popularity, origin) {
  const key = vehicleKey(make, model)
  if (key.startsWith(':') || key.endsWith(':')) return false
  const r = await Vehicle.updateOne(
    { key },
    { $setOnInsert: { key, make, model, 'ai.origin': origin }, ...(popularity ? { $set: { popularity } } : {}) },
    { upsert: true }
  )
  return Boolean(r.upsertedCount)
}

/* 1 */
async function stepCatalogue() {
  const cat = JSON.parse(await readFile(CATALOGUE, 'utf8'))
  let added = 0
  for (const [make, models] of Object.entries(cat)) {
    if (onlyBrand && brandOf(make) !== onlyBrand) continue
    for (const [i, model] of models.entries()) {
      // list order ≈ how common (first = most common); the models step refines it
      const key = vehicleKey(make, model)
      const exists = await Vehicle.exists({ key })
      if (exists) continue
      if (await upsertModel(make, model, Math.max(5, 90 - i * 4), 'catalogue')) added++
    }
  }
  console.log(`① Catalogue: ${added} new model names`)
}

/* 2 */
async function stepModels() {
  const cat = JSON.parse(await readFile(CATALOGUE, 'utf8'))
  const makes = Object.keys(cat).filter((m) => !onlyBrand || brandOf(m) === onlyBrand)
  console.log(`\n② Models: asking the AI for all models of ${makes.length} makes`)
  let added = 0
  await pool(makes, async (make) => {
    try {
      const models = await aiModelsForMake(make, FROM_YEAR)
      let n = 0
      for (const m of models) if (await upsertModel(make, m.model, m.popularity, 'ai-models')) n++
      added += n
      console.log(`   ${make}: ${models.length} models (${n} new)`)
    } catch (err) {
      console.log(`   ✗ ${make}: ${err.message}`)
    }
  })
  console.log(`   ${added} models added · ${line()}`)
}

/* 3 */
async function stepFill() {
  if (!(await Vehicle.estimatedDocumentCount())) await stepCatalogue() // first run: load the model names
  const status = has('--retry-failed') ? { $nin: ['filled'] } : { $nin: ['filled', 'failed'] }
  const filter = { reviewed: { $ne: true }, 'ai.status': status, 'ai.attempts': { $not: { $gte: has('--retry-failed') ? 4 : 2 } } }
  if (onlyBrand) filter.key = { $regex: `^${onlyBrand}:` }
  const rows = await Vehicle.find(filter, { key: 1, make: 1, model: 1, popularity: 1 }).lean()
  rows.sort((a, b) => makeWeight(b.key.split(':')[0]) * (b.popularity || 30) - makeWeight(a.key.split(':')[0]) * (a.popularity || 30))
  console.log(`\n③ Tyre sizes: ${rows.length} models to ask (most common first)`)
  let done = 0, records = 0, empty = 0
  await pool(rows, async (v) => {
    try {
      const r = await aiModelFitments(v.make, v.model, FROM_YEAR)
      if (r.unknown) {
        await Vehicle.updateOne({ _id: v._id }, { $set: { 'ai.status': 'failed', 'ai.error': 'AI: unknown model', 'ai.at': new Date() }, $inc: { 'ai.attempts': 1 } })
        empty++
      } else {
        const n = await saveAiFitments({ _id: v._id }, r.fitments)
        if (n) records += n
        else empty++
      }
    } catch (err) {
      await Vehicle.updateOne({ _id: v._id }, { $set: { 'ai.error': err.message.slice(0, 200) }, $inc: { 'ai.attempts': 1 } })
      console.log(`   ✗ ${v.make} ${v.model}: ${err.message}`)
    }
    if (++done % 20 === 0) console.log(`   ${done}/${rows.length} models · ${records} size records · ${empty} without sizes · ${line()}`)
  })
  console.log(`   ${done} models asked · ${records} size records · ${empty} without sizes`)
}

async function status() {
  const [total, filled, failed, reviewed, waiting, visitors, agg, sizes, top] = await Promise.all([
    Vehicle.countDocuments(),
    Vehicle.countDocuments({ 'ai.status': 'filled' }),
    Vehicle.countDocuments({ 'ai.status': 'failed' }),
    Vehicle.countDocuments({ reviewed: true }),
    Vehicle.countDocuments({ reviewed: { $ne: true }, 'fitments.0': { $exists: false }, 'ai.status': { $nin: ['failed'] } }),
    Vehicle.countDocuments({ 'ai.origin': 'visitor' }),
    Vehicle.aggregate([{ $project: { n: { $size: { $ifNull: ['$fitments', []] } }, v: { $size: { $setUnion: [{ $ifNull: ['$fitments.variant', []] }, []] } } } }, { $group: { _id: null, records: { $sum: '$n' }, variants: { $sum: '$v' } } }]),
    Vehicle.distinct('fitments.size'),
    Vehicle.find({ 'fitments.0': { $exists: true } }).sort({ rank: 1 }).limit(6).select('make model').lean(),
  ])
  console.log(`
Fahrzeugdatenbank
  models (Modellfamilien):  ${total}
  with tyre sizes:          ${filled + reviewed} (AI ${filled}, reviewed ${reviewed})
  waiting for the AI:       ${waiting}
  AI found nothing:         ${failed}   (--retry-failed asks again)
  added by Searchlight:     ${visitors}
  generations / variants:   ${agg[0]?.variants || 0}
  size records:             ${agg[0]?.records || 0}
  different tyre sizes:     ${sizes.length}
  most common: ${top.map((v) => `${v.make} ${v.model}`).join(', ') || '–'}
  AI model for new calls:   ${fitmentModel()}`)
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required')
  await mongoose.connect(process.env.MONGODB_URI)
  await Vehicle.init()
  if (has('--status')) return status()
  if (STEP !== 'rank' && STEP !== 'catalogue' && !process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is required')
  console.log(`AI model ${fitmentModel()} · ${CONCURRENCY} parallel · generations from ${FROM_YEAR}${ONLY ? ` · only ${ONLY}` : ''}${LIMIT < Infinity ? ` · max ${LIMIT} AI calls` : ''}\n`)
  if (STEP === 'all' || STEP === 'catalogue') await stepCatalogue()
  if ((STEP === 'all' || STEP === 'models') && budget()) await stepModels()
  if ((STEP === 'all' || STEP === 'fill') && budget()) await stepFill()
  if (STEP !== 'catalogue') console.log(`\n④ Ranked ${await recomputeRanks()} models`)
  console.log(`\n${stopping ? '⏸  Stopped' : budget() ? '✅ Done' : '⏸  AI call limit reached'} · ${line()}`)
  await status()
}

main()
  .catch((err) => {
    console.error('❌', err?.message || err)
    process.exitCode = 1
  })
  .finally(() => mongoose.disconnect())
