/**
 * Deterministic tyre picking for Searchlight: same input → same three picks.
 * Works only on our catalogue data (prices, EU label, brand, offers).
 */
export const SEASON_CATEGORY = { sommer: 'Sommerreifen', winter: 'Winterreifen', ganzjahr: 'Ganzjahresreifen' }

const PREMIUM = ['michelin', 'continental', 'bridgestone', 'goodyear', 'pirelli', 'dunlop']
const QUALITY = [
  'hankook', 'nokian', 'vredestein', 'falken', 'toyo', 'yokohama', 'kumho', 'bfgoodrich', 'uniroyal', 'semperit',
  'barum', 'fulda', 'firestone', 'kleber', 'cooper', 'nexen', 'general', 'gt radial', 'maxxis', 'kenda', 'sava',
  'debica', 'matador', 'giti', 'laufenn', 'avon', 'apollo', 'kormoran', 'riken', 'tigar',
]

export const brandTier = name => {
  const n = String(name || '').toLowerCase().trim()
  if (PREMIUM.some(b => n.startsWith(b))) return 3
  if (QUALITY.some(b => n.startsWith(b))) return 2
  return 1
}

const LETTER = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0.5, G: 0 }
export const grade = l => (l && LETTER[String(l).trim().toUpperCase()[0]] != null ? LETTER[String(l).trim().toUpperCase()[0]] : null)

export function noiseDb(p) {
  const v = Number(p?.tyre_label_info?.noise_level_db ?? p?.noise_db)
  if (Number.isFinite(v) && v > 40 && v < 90) return v
  const m = String(p?.noise_class || '').match(/(\d{2})\s*dB/i)
  return m ? Number(m[1]) : null
}

const SPEED = 'LMNPQRSTUHVWY'
export const speedRank = s => {
  const c = String(s || '').replace(/[^A-Z]/gi, '').toUpperCase()
  if (c === 'ZR') return SPEED.indexOf('W')
  return c ? SPEED.indexOf(c[0]) : -1
}

/** Customer rating 0..1 – only counted with enough reviews, else neutral. */
function ratingScore(p) {
  const r = Number(p.average_rating)
  const n = Number(p.review_count)
  if (!(r > 0) || !(n >= 3)) return 0.5
  return Math.max(0, Math.min(1, (r - 2.5) / 2.5))
}

/** Score 0..1 per dimension, higher = better. */
export function features(p, priceMin, priceMax, prefs = {}) {
  const wet = grade(p.wet_grip)
  const fuel = grade(p.fuel_class)
  const db = noiseDb(p)
  const price = p.price
  return {
    wet: wet == null ? 0.45 : wet / 5,
    fuel: fuel == null ? 0.45 : fuel / 5,
    quiet: db == null ? 0.45 : Math.max(0, Math.min(1, (76 - db) / 10)),
    brand: (brandTier(p.brand_name) - 1) / 2,
    cheap: priceMax > priceMin ? 1 - (price - priceMin) / (priceMax - priceMin) : 1,
    shops: Math.min(1, (p.offerCount || 1) / 5),
    rating: ratingScore(p),
    stock: p.bestOffer && p.bestOffer.in_stock === false ? 0 : 1,
    pref: prefs.brand && String(p.brand_name || '').toLowerCase().startsWith(String(prefs.brand).toLowerCase()) ? 1 : 0,
  }
}

export const WEIGHTS = {
  balanced: { wet: 3, fuel: 1.5, quiet: 1, brand: 2, cheap: 3, shops: 0.5, rating: 1, stock: 1, pref: 2 },
  cheap: { wet: 1.5, fuel: 0.5, quiet: 0.5, brand: 0.5, cheap: 6, shops: 0.5, rating: 0.5, stock: 1, pref: 2 },
  safety: { wet: 6, fuel: 1, quiet: 0.5, brand: 3, cheap: 1, shops: 0.5, rating: 1.5, stock: 1, pref: 2 },
  quiet: { wet: 2, fuel: 3, quiet: 4, brand: 1.5, cheap: 2, shops: 0.5, rating: 1, stock: 1, pref: 2 },
}

const RUNFLAT = /run\s*flat|\brft\b|\brsc\b|\bssr\b|\brof\b|\bzp\b|\bdsst\b|\bemt\b|\bhrs\b/i
const XL = /\bxl\b|extra\s*load|reinforced|verstärkt/i
const nameOf = p => `${p.product_name || ''} ${p.brand_name || ''}`

/** Run-flat / XL wishes: keep only matching tyres – when there are any. */
export function applyExtras(pool, { runflat, xl } = {}) {
  let out = pool
  const notes = []
  if (runflat) {
    const r = out.filter(p => RUNFLAT.test(nameOf(p)))
    if (r.length) out = r
    else notes.push('Keine Notlaufreifen (Runflat) in dieser Größe gefunden – ich zeige normale Reifen.')
  }
  if (xl) {
    const r = out.filter(p => XL.test(nameOf(p)))
    if (r.length) out = r
    else notes.push('Keine XL-Reifen gefunden – ich zeige Reifen mit passendem Lastindex.')
  }
  return { pool: out, notes }
}

function weighted(f, w) {
  let s = 0
  let t = 0
  for (const k of Object.keys(w)) {
    s += f[k] * w[k]
    t += w[k]
  }
  return s / t
}

/**
 * candidates: [{ ...product, price, offerCount }] already filtered to size/season.
 * Returns { best_price, best_choice, premium } (any may be null) – never the same product twice.
 */
export function pickThree(candidates, { priority = 'balanced', budgetPer4 = 0, minLoadIndex = 0, minSpeed = '', brand = '' } = {}) {
  let pool = candidates.filter(p => p.price > 0)
  if (minLoadIndex) pool = pool.filter(p => !p.lastIndex || Number(p.lastIndex) >= Number(minLoadIndex))
  if (minSpeed) pool = pool.filter(p => !p.speedIndex || speedRank(p.speedIndex) >= speedRank(minSpeed))
  if (!pool.length) return { best_price: null, best_choice: null, premium: null }

  const within = budgetPer4 > 0 ? pool.filter(p => p.price * 4 <= budgetPer4) : pool
  const priced = within.length ? within : pool
  const prices = pool.map(p => p.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const scored = pool.map(p => ({ p, f: features(p, lo, hi, { brand }) }))
  const key = p => p._id?.toString?.() || p.slug
  const used = new Set()

  // 1) Beste Wahl first: best weighted value for the visitor's priority, inside the budget when possible.
  //    Picking it first guarantees "Unsere Empfehlung" is always the best match.
  const w = WEIGHTS[priority] || WEIGHTS.balanced
  const choiceSrc = scored.filter(s => !budgetPer4 || !within.length || s.p.price * 4 <= budgetPer4)
  const bestChoice = choiceSrc.sort((a, b) => weighted(b.f, w) - weighted(a.f, w) || a.p.price - b.p.price)[0]?.p || null
  if (bestChoice) used.add(key(bestChoice))

  // 2) Bester Preis: cheapest solid tyre in stock (wet grip C or better when labelled)
  const inStock = priced.filter(p => !used.has(key(p)) && !(p.bestOffer && p.bestOffer.in_stock === false))
  const rest = priced.filter(p => !used.has(key(p)))
  const solid = (inStock.length ? inStock : rest).filter(p => grade(p.wet_grip) == null || grade(p.wet_grip) >= 3)
  const bestPrice = [...(solid.length ? solid : inStock.length ? inStock : rest)].sort((a, b) => a.price - b.price)[0] || null
  if (bestPrice) used.add(key(bestPrice))

  // 3) Premium: premium brand with the best label; falls back to best label overall
  const premiumPool = scored.filter(s => brandTier(s.p.brand_name) === 3 && !used.has(key(s.p)))
  const premiumSrc = premiumPool.length ? premiumPool : scored.filter(s => !used.has(key(s.p)))
  const premium = premiumSrc.sort((a, b) => weighted(b.f, WEIGHTS.safety) - weighted(a.f, WEIGHTS.safety) || a.p.price - b.p.price)[0]?.p || null

  return { best_price: bestPrice, best_choice: bestChoice, premium }
}

/**
 * "Passt zu dir" 0..100 for a pick: its weighted score for the visitor's
 * priority, placed between the weakest (55) and strongest (99) tyre of the pool.
 */
export function matchScores(candidates, picks, { priority = 'balanced', brand = '' } = {}) {
  const pool = candidates.filter(p => p.price > 0)
  if (!pool.length) return {}
  const prices = pool.map(p => p.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const w = WEIGHTS[priority] || WEIGHTS.balanced
  const all = pool.map(p => weighted(features(p, lo, hi, { brand }), w))
  const min = Math.min(...all)
  const max = Math.max(...all)
  const out = {}
  for (const [slot, p] of Object.entries(picks)) {
    if (!p) continue
    const s = weighted(features(p, lo, hi, { brand }), w)
    out[slot] = max > min ? Math.round(55 + (44 * (s - min)) / (max - min)) : 90
  }
  return out
}

const eur = n => `${Number(n).toFixed(2).replace('.', ',')} €`
const WET_TEXT = { A: 'kürzester Bremsweg bei Nässe', B: 'sehr guter Bremsweg bei Nässe', C: 'solider Bremsweg bei Nässe' }

/** Short plus and minus points shown as a checklist on each pick. */
export function prosCons(p, avgPrice) {
  const pros = []
  const cons = []
  const wet = p.wet_grip ? String(p.wet_grip).toUpperCase()[0] : ''
  const fuel = p.fuel_class ? String(p.fuel_class).toUpperCase()[0] : ''
  const db = noiseDb(p)
  if (wet && WET_TEXT[wet]) pros.push(`Nasshaftung ${wet} – ${WET_TEXT[wet]}`)
  else if (wet && 'DE'.includes(wet)) cons.push(`Nasshaftung nur ${wet} – längerer Bremsweg bei Nässe`)
  if (fuel && 'AB'.includes(fuel)) pros.push(`Rollwiderstand ${fuel} – spart Sprit bzw. Reichweite`)
  else if (fuel && 'DE'.includes(fuel)) cons.push(`Rollwiderstand ${fuel} – etwas höherer Verbrauch`)
  if (db && db <= 69) pros.push(`Leise: ${db} dB`)
  else if (db && db >= 73) cons.push(`Eher laut: ${db} dB`)
  if (avgPrice && p.price < avgPrice * 0.95) pros.push(`${eur((avgPrice - p.price) * 4)} günstiger als der Durchschnitt (4 Reifen)`)
  if (brandTier(p.brand_name) === 3) pros.push('Premiummarke')
  const r = Number(p.average_rating)
  const n = Number(p.review_count)
  if (r >= 4 && n >= 3) pros.push(`★ ${r.toFixed(1).replace('.', ',')} aus ${n} Bewertungen`)
  if ((p.offerCount || 0) > 1) pros.push(`${p.offerCount} Shops – Preis geprüft`)
  if (p.bestOffer && p.bestOffer.in_stock === false) cons.push('Beim günstigsten Shop gerade nicht auf Lager')
  return { pros: pros.slice(0, 4), cons: cons.slice(0, 2) }
}

/** Plain German facts for a pick (used directly, or handed to the AI to phrase). */
export function factsFor(p, slot, avgPrice) {
  const out = []
  if (slot === 'best_price') out.push(`Günstigster passender Reifen: 4 Stück ${eur(p.price * 4)}`)
  if (p.wet_grip) out.push(`Nasshaftung ${String(p.wet_grip).toUpperCase()[0]}`)
  if (p.fuel_class) out.push(`Rollwiderstand ${String(p.fuel_class).toUpperCase()[0]}`)
  const db = noiseDb(p)
  if (db) out.push(`${db} dB`)
  if (avgPrice && p.price < avgPrice * 0.97) out.push(`${eur(avgPrice - p.price)} unter dem Durchschnitt dieser Größe`)
  if (brandTier(p.brand_name) === 3) out.push('Premiummarke')
  if ((p.offerCount || 0) > 1) out.push(`${p.offerCount} Shops im Vergleich`)
  return out
}
