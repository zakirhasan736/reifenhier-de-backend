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

/** Score 0..1 per dimension, higher = better. */
function features(p, priceMin, priceMax) {
  const wet = grade(p.wet_grip)
  const fuel = grade(p.fuel_class)
  const db = noiseDb(p)
  const price = p.price
  return {
    wet: wet == null ? 0.5 : wet / 5,
    fuel: fuel == null ? 0.5 : fuel / 5,
    quiet: db == null ? 0.5 : Math.max(0, Math.min(1, (76 - db) / 10)),
    brand: (brandTier(p.brand_name) - 1) / 2,
    cheap: priceMax > priceMin ? 1 - (price - priceMin) / (priceMax - priceMin) : 1,
    shops: Math.min(1, (p.offerCount || 1) / 5),
  }
}

const WEIGHTS = {
  balanced: { wet: 3, fuel: 1.5, quiet: 1, brand: 2, cheap: 3, shops: 0.5 },
  cheap: { wet: 1.5, fuel: 0.5, quiet: 0.5, brand: 0.5, cheap: 6, shops: 0.5 },
  safety: { wet: 6, fuel: 1, quiet: 0.5, brand: 3, cheap: 1, shops: 0.5 },
  quiet: { wet: 2, fuel: 3, quiet: 4, brand: 1.5, cheap: 2, shops: 0.5 },
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
export function pickThree(candidates, { priority = 'balanced', budgetPer4 = 0, minLoadIndex = 0, minSpeed = '' } = {}) {
  let pool = candidates.filter(p => p.price > 0)
  if (minLoadIndex) pool = pool.filter(p => !p.lastIndex || Number(p.lastIndex) >= Number(minLoadIndex))
  if (minSpeed) pool = pool.filter(p => !p.speedIndex || speedRank(p.speedIndex) >= speedRank(minSpeed))
  if (!pool.length) return { best_price: null, best_choice: null, premium: null }

  const within = budgetPer4 > 0 ? pool.filter(p => p.price * 4 <= budgetPer4) : pool
  const priced = within.length ? within : pool
  const prices = pool.map(p => p.price)
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const scored = pool.map(p => ({ p, f: features(p, lo, hi) }))
  const used = new Set()

  // 1) Bester Preis: cheapest solid tyre (wet grip C or better when labelled)
  const solid = priced.filter(p => grade(p.wet_grip) == null || grade(p.wet_grip) >= 3)
  const bestPrice = [...(solid.length ? solid : priced)].sort((a, b) => a.price - b.price)[0] || null
  if (bestPrice) used.add(bestPrice._id?.toString?.() || bestPrice.slug)

  // 2) Premium: premium brand with the best label; falls back to best label overall
  const key = p => p._id?.toString?.() || p.slug
  const premiumPool = scored.filter(s => brandTier(s.p.brand_name) === 3 && !used.has(key(s.p)))
  const premiumSrc = premiumPool.length ? premiumPool : scored.filter(s => !used.has(key(s.p)))
  const premium =
    premiumSrc.sort(
      (a, b) =>
        weighted(b.f, WEIGHTS.safety) - weighted(a.f, WEIGHTS.safety) || a.p.price - b.p.price
    )[0]?.p || null
  if (premium) used.add(key(premium))

  // 3) Beste Wahl: best weighted value for the visitor's priority, inside the budget when possible
  const w = WEIGHTS[priority] || WEIGHTS.balanced
  const choiceSrc = scored.filter(s => !used.has(key(s.p)) && (!budgetPer4 || !within.length || s.p.price * 4 <= budgetPer4))
  const bestChoice = choiceSrc.sort((a, b) => weighted(b.f, w) - weighted(a.f, w) || a.p.price - b.p.price)[0]?.p || null

  return { best_price: bestPrice, best_choice: bestChoice, premium }
}

const eur = n => `${Number(n).toFixed(2).replace('.', ',')} €`

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
