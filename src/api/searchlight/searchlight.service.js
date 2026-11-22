import Product from '../../models/product.js'
import CarSizeCache from '../../models/carSizeCache.js'
import { llmJson, llmAvailable } from './llm.js'
import { SEASON_CATEGORY, pickThree, factsFor, grade, noiseDb, brandTier } from './scoring.js'

const toNum = v => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Live offers sorted like the site: in stock first, then price. */
function offersOf(p) {
  return (Array.isArray(p.offers) ? p.offers : [])
    .map(o => ({ ...o, price: toNum(o.price) }))
    .filter(o => o.price > 0)
    .sort((a, b) => Number(a.in_stock === false) - Number(b.in_stock === false) || a.price - b.price)
}

const SELECT = {
  slug: 1, product_name: 1, brand_name: 1, product_image: 1, awin_image_url: 1, merchant_thumb_url: 1,
  width: 1, height: 1, diameter: 1, lastIndex: 1, speedIndex: 1, merchant_product_third_category: 1,
  fuel_class: 1, wet_grip: 1, noise_class: 1, tyre_label_info: 1, offers: 1, cheapest_offer: 1, price_trend: 1,
  average_rating: 1, review_count: 1, ean: 1,
}

function withPrice(p) {
  const offers = offersOf(p)
  const best = offers[0]
  return { ...p, price: best?.price || toNum(p.cheapest_offer), bestOffer: best || null, offerCount: offers.length }
}

/** Public card shape for the frontend (no internal fields). */
export function card(p, slot, reason) {
  const o = p.bestOffer || {}
  return {
    slot,
    id: String(p._id),
    slug: p.slug,
    name: p.product_name,
    brand: p.brand_name,
    image: p.product_image || p.awin_image_url || p.merchant_thumb_url || '',
    size: p.width && p.height && p.diameter ? `${p.width}/${p.height} R${p.diameter}` : '',
    index: `${p.lastIndex || ''}${p.speedIndex || ''}`,
    season: p.merchant_product_third_category || '',
    wet: p.wet_grip ? String(p.wet_grip).toUpperCase()[0] : '',
    fuel: p.fuel_class ? String(p.fuel_class).toUpperCase()[0] : '',
    noiseDb: noiseDb(p),
    price: Math.round(p.price * 100) / 100,
    priceFor4: Math.round(p.price * 4 * 100) / 100,
    offerCount: p.offerCount,
    vendor: o.vendor || '',
    vendorId: o.vendor_id || '',
    token: o.affiliate_product_cloak_url || '',
    reason: reason || '',
  }
}

export async function findCandidates({ width, height, diameter, season }) {
  const q = { width: String(width), height: String(height), diameter: String(diameter), cheapest_offer: { $gt: 0 } }
  if (season && SEASON_CATEGORY[season]) q.merchant_product_third_category = SEASON_CATEGORY[season]
  const rows = await Product.find(q).select(SELECT).limit(400).lean()
  return rows.map(withPrice).filter(p => p.price > 0)
}

const SLOT_LABEL = { best_price: 'Bester Preis', best_choice: 'Beste Wahl', premium: 'Premium' }

/** Short German reasons: AI-phrased when available, else the plain facts. */
async function reasons(picks, avg, criteria) {
  const facts = Object.fromEntries(Object.entries(picks).filter(([, p]) => p).map(([slot, p]) => [slot, factsFor(p, slot, avg)]))
  const fallback = Object.fromEntries(Object.entries(facts).map(([k, f]) => [k, f.slice(0, 3).join(' · ')]))
  if (!llmAvailable() || !Object.keys(facts).length) return fallback
  const out = await llmJson({
    system:
      'Du schreibst für einen deutschen Reifen-Preisvergleich kurze Begründungen. Nutze NUR die gelieferten Fakten, erfinde nichts (keine Testergebnisse, keine Zahlen, die nicht genannt sind). Je Reifen ein Satz, höchstens 18 Wörter, Du-Form. Antworte nur mit JSON.',
    prompt: `Kunde: ${JSON.stringify(criteria)}\nReifen und Fakten: ${JSON.stringify(
      Object.fromEntries(Object.entries(picks).filter(([, p]) => p).map(([slot, p]) => [slot, { kategorie: SLOT_LABEL[slot], reifen: `${p.brand_name} ${p.product_name}`, fakten: facts[slot] }]))
    )}\nAntwortformat: {"best_price":"…","best_choice":"…","premium":"…"}`,
    maxTokens: 300,
  })
  if (!out) return fallback
  return Object.fromEntries(Object.keys(facts).map(k => [k, typeof out[k] === 'string' && out[k].length < 220 ? out[k] : fallback[k]]))
}

const SEASONS = ['sommer', 'winter', 'ganzjahr']
const PRIORITIES = ['balanced', 'cheap', 'safety', 'quiet']

/** Free text → criteria (AI). Returns null if no AI is configured. */
export async function understand(text, known = {}) {
  return llmJson({
    system:
      'Du extrahierst aus einer Kundenanfrage für Autoreifen strukturierte Kriterien. Erfinde keine Reifengröße: nur wenn der Kunde sie nennt. Antworte nur mit JSON.',
    prompt: `Bereits bekannt: ${JSON.stringify(known)}\nAnfrage: """${String(text).slice(0, 600)}"""\nJSON-Felder: width (z.B. "205"), height ("55"), diameter ("16"), season ("sommer"|"winter"|"ganzjahr"|null), priority ("balanced"|"cheap"|"safety"|"quiet"), budgetPer4 (Zahl in Euro für 4 Reifen oder 0), minLoadIndex (Zahl oder 0), minSpeed (Buchstabe oder ""), car ({"make":"","model":"","year":""} wenn ein Auto genannt ist), followUp (eine kurze Rückfrage auf Deutsch, wenn Größe UND Auto fehlen oder die Saison unklar ist, sonst "").`,
    maxTokens: 300,
  })
}

/**
 * Main entry: criteria (from quick questions and/or text) → three picks.
 * input: { width, height, diameter, season, priority, budgetPer4, text, car }
 */
export async function recommend(input = {}) {
  let c = {
    width: input.width,
    height: input.height,
    diameter: input.diameter,
    season: SEASONS.includes(input.season) ? input.season : null,
    priority: PRIORITIES.includes(input.priority) ? input.priority : 'balanced',
    budgetPer4: Number(input.budgetPer4) || 0,
    minLoadIndex: Number(input.minLoadIndex) || 0,
    minSpeed: String(input.minSpeed || ''),
  }
  if (input.text) {
    const u = await understand(input.text, c)
    if (u) {
      for (const k of ['width', 'height', 'diameter']) if (!c[k] && u[k]) c[k] = String(u[k]).replace(/\D/g, '')
      if (!c.season && SEASONS.includes(u.season)) c.season = u.season
      if (input.priority == null && PRIORITIES.includes(u.priority)) c.priority = u.priority
      if (!c.budgetPer4 && Number(u.budgetPer4) > 0) c.budgetPer4 = Number(u.budgetPer4)
      if (!c.minLoadIndex && Number(u.minLoadIndex) > 0) c.minLoadIndex = Number(u.minLoadIndex)
      if (!c.minSpeed && u.minSpeed) c.minSpeed = String(u.minSpeed).slice(0, 2)
      if (u.car?.model) c.car = u.car
      if (u.followUp && !(c.width && c.height && c.diameter)) c.followUp = String(u.followUp).slice(0, 200)
    } else if (!(c.width && c.height && c.diameter)) {
      // no AI configured: try to read a size directly from the text
      const m = String(input.text).match(/(\d{3})\s*\/\s*(\d{2})\s*Z?R?\s*(\d{2})/i)
      if (m) [c.width, c.height, c.diameter] = [m[1], m[2], m[3]]
      if (/winter/i.test(input.text)) c.season = 'winter'
      else if (/sommer/i.test(input.text)) c.season = 'sommer'
      else if (/ganzjahr|allwetter|all.?season/i.test(input.text)) c.season = 'ganzjahr'
    }
  }

  if (!(c.width && c.height && c.diameter)) {
    return {
      criteria: c,
      needs: 'size',
      message: c.followUp || 'Welche Reifengröße fährst du? Du findest sie auf der Reifenflanke, z. B. 205/55 R16 – oder nenne mir dein Auto.',
      picks: [],
    }
  }

  const candidates = await findCandidates(c)
  if (!candidates.length) {
    return { criteria: c, needs: null, message: `Für ${c.width}/${c.height} R${c.diameter}${c.season ? ` (${SEASON_CATEGORY[c.season]})` : ''} haben wir gerade keine Angebote.`, picks: [] }
  }
  const avg = candidates.reduce((a, p) => a + p.price, 0) / candidates.length
  const picks = pickThree(candidates, c)
  const why = await reasons(picks, avg, c)
  return {
    criteria: c,
    needs: null,
    total: candidates.length,
    message: `Ich habe ${candidates.length} passende Reifen verglichen. Das sind meine drei Empfehlungen:`,
    picks: ['best_price', 'best_choice', 'premium'].filter(s => picks[s]).map(s => card(picks[s], s, why[s])),
  }
}

/** Product page: is this tyre worth it? */
export async function productCheck(slug) {
  const raw = await Product.findOne({ slug: String(slug) }).select(SELECT).lean()
  if (!raw) return null
  const p = withPrice(raw)
  const season = Object.entries(SEASON_CATEGORY).find(([, v]) => v === p.merchant_product_third_category)?.[0] || null
  const pool = p.width ? await findCandidates({ width: p.width, height: p.height, diameter: p.diameter, season }) : []
  const others = pool.filter(x => String(x._id) !== String(p._id))
  const prices = pool.map(x => x.price).sort((a, b) => a - b)
  const rank = prices.length ? prices.filter(x => x < p.price).length / prices.length : 0
  const wetP = grade(p.wet_grip) ?? 0

  const cheaperSimilar = others
    .filter(x => x.price < p.price && (grade(x.wet_grip) ?? 0) >= wetP && brandTier(x.brand_name) >= Math.min(2, brandTier(p.brand_name)))
    .sort((a, b) => a.price - b.price)[0]
  const betterForLittleMore = others
    .filter(x => x.price > p.price && x.price <= p.price * 1.15 && (grade(x.wet_grip) ?? 0) > wetP)
    .sort((a, b) => (grade(b.wet_grip) ?? 0) - (grade(a.wet_grip) ?? 0) || a.price - b.price)[0]

  // 30-day trend from stored daily points
  const pts = Array.isArray(p.price_trend?.points) ? p.price_trend.points : []
  let trendPct = null
  if (pts.length > 1) {
    const cut = Date.now() - 30 * 864e5
    const first = pts.find(([d]) => Date.parse(d) >= cut) || pts[0]
    const last = pts[pts.length - 1]
    if (first?.[1] > 0) trendPct = Math.round(((last[1] - first[1]) / first[1]) * 100)
  }

  const verdict =
    rank <= 0.25 ? 'Günstig: dieser Reifen gehört zu den preiswertesten seiner Größe.'
      : rank <= 0.6 ? 'Fairer Preis im Mittelfeld seiner Größe.'
        : 'Eher teuer für diese Größe – prüfe die Alternativen.'
  const avg = pool.length ? pool.reduce((a, x) => a + x.price, 0) / pool.length : p.price
  return {
    product: card(p, 'current', factsFor(p, 'current', avg).slice(0, 3).join(' · ')),
    sameSizeCount: pool.length,
    pricePosition: Math.round(rank * 100),
    trendPct,
    verdict,
    timing:
      trendPct == null ? '' : trendPct <= -5 ? `Der Preis ist in 30 Tagen um ${Math.abs(trendPct)} % gefallen – guter Zeitpunkt.` : trendPct >= 5 ? `Der Preis ist in 30 Tagen um ${trendPct} % gestiegen – ein Preisalarm kann sich lohnen.` : 'Der Preis ist in den letzten 30 Tagen stabil.',
    alternatives: [
      cheaperSimilar && card(cheaperSimilar, 'cheaper', `${(p.price - cheaperSimilar.price).toFixed(2).replace('.', ',')} € günstiger pro Reifen bei ähnlicher Nasshaftung`),
      betterForLittleMore && card(betterForLittleMore, 'better', `Bessere Nasshaftung (${String(betterForLittleMore.wet_grip).toUpperCase()[0]}) für ${(betterForLittleMore.price - p.price).toFixed(2).replace('.', ',')} € mehr`),
    ].filter(Boolean),
  }
}

/** Tyre photo → size (AI vision). image = data URL. */
export async function readTyrePhoto(dataUrl) {
  const m = /^data:(image\/(jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
  if (!m) return { error: 'invalid_image' }
  if (m[3].length > 5_500_000) return { error: 'image_too_large' }
  const out = await llmJson({
    kind: 'vision',
    system:
      'Du liest Beschriftungen auf Reifenflanken. Gib nur zurück, was wirklich lesbar ist; unsichere Felder leer lassen. Antworte nur mit JSON.',
    prompt:
      'Lies die Reifengröße und weitere Angaben von diesem Foto einer Reifenflanke. JSON: {"width":"205","height":"55","diameter":"16","loadIndex":"91","speedIndex":"H","brand":"","model":"","dot":"","season":"sommer|winter|ganzjahr|","confidence":"high|medium|low","hint":"kurzer deutscher Hinweis, falls das Foto unscharf ist"}',
    image: { mediaType: m[1], base64: m[3] },
    maxTokens: 250,
  })
  if (!out) return { error: llmAvailable() ? 'not_readable' : 'ai_not_configured' }
  const ok = /^\d{3}$/.test(out.width) && /^\d{2}$/.test(out.height) && /^\d{2}$/.test(out.diameter)
  return { ...out, ok }
}

/**
 * Car → tyre sizes. Uses the Wheel-Size API (EU market) when WHEEL_SIZE_API_KEY is set,
 * otherwise the AI with a clear "please confirm on the sidewall" note.
 */
export async function carSizes({ make, model, year }) {
  make = String(make || '').trim().slice(0, 40)
  model = String(model || '').trim().slice(0, 60)
  year = String(year || '').replace(/\D/g, '').slice(0, 4)
  if (!make || !model) return { error: 'missing_car' }
  const key = process.env.WHEEL_SIZE_API_KEY
  if (key) {
    try {
      const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const u = new URL('https://api.wheel-size.com/v2/search/by_model/')
      u.searchParams.set('make', slug(make))
      u.searchParams.set('model', slug(model))
      if (year) u.searchParams.set('year', year)
      u.searchParams.set('region', 'eudm')
      u.searchParams.set('user_key', key)
      const r = await fetch(u, { signal: AbortSignal.timeout(10000) })
      if (r.ok) {
        const j = await r.json()
        const sizes = new Map()
        for (const mod of j.data || []) {
          for (const wh of mod.wheels || []) {
            const t = wh.front?.tire_full || wh.front?.tire
            const mm = /(\d{3})\/(\d{2})\s*Z?R(\d{2})\s*(\d{2,3})?([A-Z])?/.exec(t || '')
            if (mm) {
              const k = `${mm[1]}/${mm[2]} R${mm[3]}`
              if (!sizes.has(k)) sizes.set(k, { width: mm[1], height: mm[2], diameter: mm[3], loadIndex: mm[4] || '', speedIndex: mm[5] || '', original: Boolean(wh.is_stock) })
            }
          }
        }
        if (sizes.size) return { source: 'wheel-size', sizes: [...sizes.values()].slice(0, 8), note: 'Werksfreigaben laut Fahrzeugdaten.' }
      } else console.error('[searchlight] wheel-size', r.status)
    } catch (err) {
      console.error('[searchlight] wheel-size failed:', err?.message || err)
    }
  }
  const cacheKey = `${make}|${model}|${year}`.toLowerCase()
  const cached = await CarSizeCache.findOne({ key: cacheKey }).lean().catch(() => null)
  if (cached?.sizes?.length) {
    return { source: 'ai', generation: cached.generation || '', sizes: cached.sizes, cached: true, note: 'Typische Größen für dieses Modell – bitte vor dem Kauf auf deiner Reifenflanke oder im CoC-Papier prüfen.' }
  }
  const out = await llmJson({
    system:
      'Du kennst die werksseitigen Reifengrößen von Autos auf dem deutschen Markt. Nenne nur Größen, die für dieses Modell üblich sind. Wenn du unsicher bist, gib weniger Größen an. Antworte nur mit JSON.',
    prompt: `Auto: ${make} ${model}${year ? ` Baujahr ${year}` : ''}. JSON: {"sizes":[{"width":"205","height":"55","diameter":"16","loadIndex":"91","speedIndex":"V"}],"generation":"z. B. Golf 7 (2012–2019)"} – höchstens 5 Größen, häufigste zuerst.`,
    maxTokens: 350,
  })
  const sizes = (out?.sizes || []).filter(s => /^\d{3}$/.test(s.width) && /^\d{2}$/.test(s.height) && /^\d{2}$/.test(s.diameter)).slice(0, 5)
  if (!sizes.length) return { error: llmAvailable() ? 'unknown_car' : 'ai_not_configured' }
  CarSizeCache.updateOne({ key: cacheKey }, { $set: { generation: out.generation || '', sizes, source: 'ai', createdAt: new Date() } }, { upsert: true }).catch(() => {})
  return {
    source: 'ai',
    generation: out.generation || '',
    sizes,
    note: 'Typische Größen für dieses Modell – bitte vor dem Kauf auf deiner Reifenflanke oder im CoC-Papier prüfen.',
  }
}
