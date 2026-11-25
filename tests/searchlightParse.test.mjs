import test from 'node:test'
import assert from 'node:assert/strict'

delete process.env.ANTHROPIC_API_KEY
delete process.env.OPENAI_API_KEY
const { parseSize, parseSeason, parseBudget, parsePriority, parseCar, parseQuery, seasonForDate } = await import('../src/api/searchlight/parse.js')
const { applyExtras, prosCons } = await import('../src/api/searchlight/scoring.js')

test('sizes in every common spelling', () => {
  for (const t of ['205/55 R16', '205/55R16', '205 55 16', '205-55-16', '2055516', 'suche 205/55 r 16 reifen', '205/55/16']) {
    const s = parseSize(t)
    assert.deepEqual([s?.width, s?.height, s?.diameter], ['205', '55', '16'], t)
  }
  const z = parseSize('225/45 ZR17 94W XL')
  assert.deepEqual([z.width, z.height, z.diameter, z.minLoadIndex, z.minSpeed], ['225', '45', '17', 94, 'W'])
  assert.equal(parseSize('Golf 7 bis 400 €'), null)
  assert.equal(parseSize('Baujahr 2018'), null)
})

test('season, budget, priority', () => {
  assert.equal(parseSeason('Winterreifen bitte'), 'winter')
  assert.equal(parseSeason('Allwetterreifen'), 'ganzjahr')
  assert.equal(parseSeason('für den Sommer'), 'sommer')
  assert.equal(parseBudget('bis 400 €'), 400)
  assert.equal(parseBudget('unter 90 Euro pro Reifen'), 360)
  assert.equal(parseBudget('max 80€'), 320) // small number = per tyre
  assert.equal(parseBudget('500 € für alle 4'), 500)
  assert.equal(parsePriority('möglichst günstig'), 'cheap')
  assert.equal(parsePriority('sicher bei Regen, Familie'), 'safety')
  assert.equal(parsePriority('leise für mein E-Auto'), 'quiet')
})

test('car models from a sentence', () => {
  assert.deepEqual(parseCar('Winterreifen für meinen Golf 7 bis 400 €'), null) // no make named
  assert.deepEqual(parseCar('VW Golf 7 Baujahr 2018'), { make: 'VW', model: 'Golf 7', year: '2018' })
  assert.deepEqual(parseCar('reifen für bmw 3er touring'), { make: 'BMW', model: '3er Touring', year: '' })
  assert.deepEqual(parseCar('Mercedes-Benz A-Klasse 2020 winterreifen'), { make: 'Mercedes', model: 'A-klasse', year: '2020' })
  assert.equal(parseCar('Tesla Model 3 leise').model, 'Model 3')
})

test('parseQuery combines everything; size beats car', () => {
  const q = parseQuery('Continental Winterreifen 205/55 R16 91H für VW Golf bis 500 €')
  assert.equal(q.width, '205')
  assert.equal(q.season, 'winter')
  assert.equal(q.brand, 'Continental')
  assert.equal(q.budgetPer4, 500)
  assert.equal(q.minLoadIndex, 91)
  assert.equal(q.car, undefined)
  const q2 = parseQuery('Skoda Octavia Ganzjahresreifen günstig')
  assert.deepEqual(q2.car, { make: 'Skoda', model: 'Octavia', year: '' })
  assert.equal(q2.season, 'ganzjahr')
  assert.equal(q2.priority, 'cheap')
})

test('season by month', () => {
  assert.equal(seasonForDate(new Date('2026-11-01')), 'winter')
  assert.equal(seasonForDate(new Date('2026-04-15')), 'sommer')
})

test('runflat filter and pros/cons', () => {
  const pool = [{ product_name: 'Turanza T005 RFT', price: 90 }, { product_name: 'Turanza T005', price: 80 }]
  assert.equal(applyExtras(pool, { runflat: true }).pool.length, 1)
  assert.equal(applyExtras([pool[1]], { runflat: true }).notes.length, 1)
  const pc = prosCons({ wet_grip: 'A', fuel_class: 'E', tyre_label_info: { noise_level_db: 74 }, price: 50, offerCount: 3, brand_name: 'Michelin' }, 70)
  assert.ok(pc.pros.some(x => x.startsWith('Nasshaftung A')))
  assert.ok(pc.cons.some(x => x.startsWith('Rollwiderstand E')))
  assert.ok(pc.cons.some(x => x.includes('74 dB')))
})
