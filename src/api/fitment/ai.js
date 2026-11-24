/**
 * AI calls that fill Reifexa's own vehicle → tyre-size database (Anthropic only).
 * Records are marked as KI-Vorschlag until an admin reviews the model.
 * FITMENT_MODEL (default claude-haiku-5-5; claude-sonnet-5-5 is more accurate
 * but costs more). Token usage is counted so the seed script can show the cost.
 */
import { parseJson } from '../searchlight/llm.js'
import { AI_SOURCE_PREFIX } from './data.js'

const URL = 'https://api.anthropic.com/v1/messages'
export const usage = { calls: 0, input: 0, output: 0, failed: 0 }

export const fitmentModel = () => process.env.FITMENT_MODEL || 'claude-haiku-5-5'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function ask({ system, prompt, maxTokens = 2000, tries = 4 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  let lastErr
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(URL, {
        method: 'POST',
        signal: AbortSignal.timeout(120000),
        headers: {
          'content-type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: fitmentModel(),
          max_tokens: maxTokens,
          system,
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (r.status === 429 || r.status === 529 || r.status >= 500) {
        lastErr = new Error(`anthropic ${r.status}`)
        const wait = Number(r.headers.get('retry-after')) * 1000 || 5000 * 2 ** i
        await sleep(Math.min(wait, 60000))
        continue
      }
      if (!r.ok) throw new Error(`anthropic ${r.status}: ${(await r.text()).slice(0, 200)}`)
      const j = await r.json()
      usage.calls++
      usage.input += j.usage?.input_tokens || 0
      usage.output += j.usage?.output_tokens || 0
      const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n')
      const json = parseJson(text)
      if (!json) throw new Error('no JSON in reply' + (j.stop_reason === 'max_tokens' ? ' (reply too long)' : ''))
      return json
    } catch (err) {
      lastErr = err
      if (/anthropic 4\d\d/.test(err.message) && !/429/.test(err.message)) break
      await sleep(2000 * (i + 1))
    }
  }
  usage.failed++
  throw lastErr
}

const MARKET =
  'You are an automotive data specialist for the German car market (passenger cars and SUVs/vans up to 3.5 t, ' +
  'sold new in Germany). Use the official model names as German dealers use them. Be factual; never invent models. ' +
  'Reply with JSON only, no text around it.'

/** All models of a make sold new in Germany from FROM_YEAR until today. */
export async function aiModelsForMake(make, fromYear = 2000) {
  const j = await ask({
    system: MARKET,
    maxTokens: 4000,
    prompt:
      `List every passenger-car model of the make "${make}" that was sold new in Germany from ${fromYear} until today ` +
      `(also discontinued ones, electric and hybrid models, SUVs and small vans like VW Caddy/Touran; no trucks, no motorbikes). ` +
      `For each: the model name without generation number (e.g. "Golf", "3er", "A4", "Model 3"), and "popularity" 1–100 = how common it is on German roads today ` +
      `(100 = very common like VW Golf, 1 = very rare). JSON: {"models":[{"model":"Golf","popularity":100}]}`,
  })
  return (j?.models || []).filter((m) => m?.model).map((m) => ({ model: String(m.model).trim().slice(0, 60), popularity: clamp(m.popularity) }))
}

const SIZE_RULES =
  'Give the factory-approved summer tyre sizes as listed in the CoC papers (Feld 32/15 im Fahrzeugschein), ' +
  'most common first, max 6 per generation, with load index and speed index. If front and rear differ (staggered), ' +
  'give both with axle "front" and "rear", otherwise axle "both". confidence: "high" if sure, "medium" if typical, "low" if unsure. ' +
  'Never invent sizes for cars you do not know – leave them out.'

function toFitments(generations, model) {
  const now = new Date().getUTCFullYear()
  const out = []
  for (const g of Array.isArray(generations) ? generations : []) {
    const variant = String(g?.generation || g?.variant || '').trim().slice(0, 120)
    const yearFrom = year(g?.yearFrom)
    const yearTo = g?.yearTo == null || g?.yearTo === '' ? now : year(g?.yearTo)
    if (!variant || !yearFrom || !yearTo || yearFrom > yearTo) continue
    for (const s of Array.isArray(g.sizes) ? g.sizes : []) {
      const size = `${String(s?.width ?? '').replace(/\D/g, '')}/${String(s?.height ?? '').replace(/\D/g, '')} R${String(s?.diameter ?? '').replace(/\D/g, '')}`
      const axle = ['front', 'rear'].includes(s?.axle) ? s.axle : 'both'
      const conf = ['high', 'medium', 'low'].includes(s?.confidence) ? s.confidence : 'medium'
      out.push({
        size, variant, yearFrom, yearTo: Math.min(yearTo, now + 1), axle,
        source: `${AI_SOURCE_PREFIX} (${fitmentModel()}, Sicherheit ${conf}) – bitte prüfen`,
        loadIndex: String(s?.loadIndex ?? '').replace(/\D/g, ''),
        speedIndex: String(s?.speedIndex ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1),
      })
    }
  }
  return out
}

/**
 * All generations of one model since FROM_YEAR with their factory tyre sizes,
 * as fitment records in our format (validated by the caller).
 */
export async function aiModelFitments(make, model, fromYear = 2000) {
  const j = await ask({
    system: MARKET + ' You know the factory-approved (Werksfreigabe / CoC) tyre sizes of cars sold in Germany.',
    maxTokens: 4000,
    prompt:
      `Car model: ${make} ${model}. List its generations sold new in Germany from ${fromYear} until today, oldest first, ` +
      `with names German buyers know (e.g. "Golf 7 (5G)", "3er (G20)", "A4 (B9)") and build years (yearTo null if still built). ` +
      `For each generation: ${SIZE_RULES}\n` +
      `If "${model}" is not a real ${make} model sold in Germany, return {"unknown":true}.\n` +
      `JSON: {"generations":[{"generation":"Golf 7 (5G)","yearFrom":2012,"yearTo":2020,"sizes":[{"width":"205","height":"55","diameter":"16","loadIndex":"91","speedIndex":"V","axle":"both","confidence":"high"}]}]}`,
  })
  if (j?.unknown) return { unknown: true, fitments: [] }
  return { unknown: false, fitments: toFitments(j?.generations, model) }
}

/** One car typed by a Searchlight visitor that is not in our table yet. */
export async function aiOneCar(make, model) {
  const j = await ask({
    system: MARKET + ' You know the factory-approved tyre sizes of cars sold in Germany.',
    maxTokens: 3000,
    tries: 2,
    prompt:
      `A visitor typed the car "${make} ${model}". Give the official make and model name (model without generation number, ` +
      `e.g. "Golf", "3er", "A4") and all generations sold in Germany since 2000 with build years and factory tyre sizes. ` +
      `${SIZE_RULES} If this is not a real car, return {"unknown":true}.\n` +
      `JSON: {"make":"VW","model":"Golf","generations":[{"generation":"Golf 7 (5G)","yearFrom":2012,"yearTo":2020,"sizes":[{"width":"205","height":"55","diameter":"16","loadIndex":"91","speedIndex":"V","axle":"both","confidence":"high"}]}]}`,
  })
  if (!j || j.unknown) return null
  return { make: String(j.make || make).trim().slice(0, 40), model: String(j.model || model).trim().slice(0, 60), fitments: toFitments(j.generations, model) }
}

function clamp(n) {
  const x = Math.round(Number(n))
  return Number.isFinite(x) ? Math.max(1, Math.min(100, x)) : 30
}
function year(n) {
  const x = Number(n)
  return Number.isInteger(x) && x >= 1950 && x <= 2100 ? x : null
}
