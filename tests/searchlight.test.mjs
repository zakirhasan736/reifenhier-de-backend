import test from 'node:test'
import assert from 'node:assert/strict'

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
const { pickThree, brandTier, grade, speedRank } = await import('../src/api/searchlight/scoring.js')
const { parseJson } = await import('../src/api/searchlight/llm.js')
const svc = await import('../src/api/searchlight/searchlight.service.js')
const { default: Product } = await import('../src/models/product.js')
const P = (id, brand, price, wet, fuel, db, li = '91', si = 'H', offers = 3) => ({
  _id: id, slug: id, brand_name: brand, product_name: `${brand} ${id}`, width: '205', height: '55', diameter: '16',
  lastIndex: li, speedIndex: si, merchant_product_third_category: 'Winterreifen', wet_grip: wet, fuel_class: fuel,
  tyre_label_info: { noise_level_db: db }, cheapest_offer: price,
  offers: Array.from({ length: offers }, (_, i) => ({ vendor: `Shop${i}`, vendor_id: `${100 + i}`, price: String(price + i * 5).replace('.', ','), affiliate_product_cloak_url: `tok-${id}-${i}` })),
})
const catalogue = [
  P('budget-e', 'Linglong', 41, 'E', 'E', 72),
  P('budget-c', 'Tristar', 47.5, 'C', 'D', 71),
  P('mid-b', 'Hankook', 62, 'B', 'C', 70),
  P('mid-a', 'Kumho', 66, 'A', 'C', 69),
  P('prem-b', 'Continental', 88, 'B', 'B', 70),
  P('prem-a', 'MICHELIN', 96, 'A', 'B', 68),
]
const withPrice = rows => rows.map(p => ({ ...p, price: p.cheapest_offer, offerCount: p.offers.length }))

test('helpers', () => {
  assert.equal(brandTier('MICHELIN'), 3)
  assert.equal(brandTier('Hankook'), 2)
  assert.equal(brandTier('Linglong'), 1)
  assert.equal(grade('b'), 4)
  assert.ok(speedRank('V') > speedRank('H'))
  assert.deepEqual(parseJson('Here you go: {"a":1} thanks'), { a: 1 })
})

test('three different picks: cheapest solid, premium, best value', () => {
  const r = pickThree(withPrice(catalogue), { priority: 'balanced' })
  assert.equal(r.best_price.slug, 'budget-c') // E wet grip is skipped for "Bester Preis"
  assert.equal(r.premium.slug, 'prem-a')
  assert.ok(['mid-a', 'mid-b'].includes(r.best_choice.slug), r.best_choice.slug)
  assert.equal(new Set([r.best_price.slug, r.premium.slug, r.best_choice.slug]).size, 3)
})

test('budget and minimum load index are respected', () => {
  const r = pickThree(withPrice(catalogue), { priority: 'balanced', budgetPer4: 260 })
  assert.ok(r.best_choice.price * 4 <= 260)
  const r2 = pickThree(withPrice([...catalogue, P('heavy', 'Hankook', 70, 'A', 'B', 69, '95', 'V')]), { minLoadIndex: 94 })
  assert.equal(r2.best_choice.slug, 'heavy') // the only tyre with load index 94+ is the recommendation
})

test('recommend(): quick answers → three cards with shop tokens (no AI needed)', async () => {
  let query
  Product.find = q => {
    query = q
    return { select: () => ({ limit: () => ({ lean: async () => catalogue }) }) }
  }
  const r = await svc.recommend({ width: '205', height: '55', diameter: '16', season: 'winter', priority: 'safety' })
  assert.equal(query.merchant_product_third_category, 'Winterreifen')
  assert.equal(r.picks.length, 3)
  assert.deepEqual(r.picks.map(p => p.slot), ['best_choice', 'best_price', 'premium'])
  for (const p of r.picks) assert.ok(p.match >= 55 && p.match <= 99, `match ${p.match}`)
  assert.ok(r.picks[0].pros.length > 0)
  assert.ok(r.summary.minPrice <= r.summary.avgPrice)
  for (const p of r.picks) {
    assert.ok(p.token.startsWith('tok-'))
    assert.ok(p.reason.length > 5)
    assert.equal(p.priceFor4, Math.round(p.price * 400) / 100)
  }
})

test('recommend(): free text without AI still reads a size from the text', async () => {
  const r = await svc.recommend({ text: 'Suche Winterreifen 205/55 R16 für meinen Golf' })
  assert.equal(r.criteria.width, '205')
  assert.equal(r.criteria.season, 'winter')
  assert.equal(r.picks.length, 3)
  const r2 = await svc.recommend({ text: 'Reifen für meinen Golf' })
  assert.equal(r2.needs, 'size')
})

test('photo and car without AI give clear errors', async () => {
  assert.equal((await svc.readTyrePhoto('not-an-image')).error, 'invalid_image')
  assert.equal((await svc.readTyrePhoto('data:image/jpeg;base64,AAAA')).error, 'ai_not_configured')
  assert.equal((await svc.carSizes({ make: 'VW', model: '' })).error, 'missing_car')
})

test('vehicle lookup without a database never calls the AI', async t => {
  const externalFetch = t.mock.method(globalThis, 'fetch', async () => {
    throw new Error('no AI call without our database')
  })
  const result = await svc.carSizes({ make: 'VW', model: 'Golf', year: '2016' })
  assert.equal(result.error, 'unknown_car')
  assert.equal(externalFetch.mock.callCount(), 0)
})

test('recommend(): sentence with budget, brand wish and assumed season', async () => {
  Product.find = () => ({ select: () => ({ limit: () => ({ lean: async () => catalogue }) }) })
  const r = await svc.recommend({ text: '205 55 16 Hankook bis 300 €' })
  assert.equal(r.criteria.budgetPer4, 300)
  assert.equal(r.criteria.brand, 'Hankook')
  assert.equal(r.criteria.seasonAssumed, true)
  assert.equal(r.picks[0].slot, 'best_choice')
  assert.match(r.picks[0].brand, /Hankook/)
  assert.ok(r.picks[0].priceFor4 <= 300)
})

test('recommend(): a car we cannot look up asks for the size and names the car', async () => {
  const r = await svc.recommend({ text: 'Winterreifen für VW Golf 7' })
  assert.equal(r.needs, 'size')
  assert.match(r.message, /VW Golf 7/)
})
