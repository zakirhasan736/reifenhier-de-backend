import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { createHash } from 'node:crypto'

process.env.ANTHROPIC_API_KEY = 'test'
const data = await import('../src/api/fitment/data.js')
const { Vehicle, Access, plans } = data
const service = await import('../src/api/fitment/service.js')
const { router } = await import('../src/api/fitment/routes.js')

const reply = (obj) => new Response(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(obj) }], usage: { input_tokens: 10, output_tokens: 20 } }), { status: 200 })

test('AI records are validated, de-duplicated and marked as KI-Vorschlag', async (t) => {
  const { aiModelFitments } = await import('../src/api/fitment/ai.js')
  t.mock.method(globalThis, 'fetch', async () => reply({
    generations: [
      { generation: 'Golf 7 (5G)', yearFrom: 2012, yearTo: 2020, sizes: [
        { width: '205', height: '55', diameter: '16', loadIndex: '91', speedIndex: 'v', axle: 'both', confidence: 'high' },
        { width: '205', height: '55', diameter: '16', loadIndex: '91', speedIndex: 'V' },
        { width: '999', height: '1', diameter: '3' },
      ] },
      { generation: 'Golf 8 (CD)', yearFrom: 2019, yearTo: null, sizes: [{ width: '225', height: '45', diameter: '17', axle: 'both' }] },
    ],
  }))
  const r = await aiModelFitments('VW', 'Golf')
  const clean = service.cleanFitments(r.fitments)
  assert.equal(clean.length, 2)
  assert.deepEqual(clean.map((f) => f.size), ['205/55 R16', '225/45 R17'])
  assert.equal(clean[0].speedIndex, 'V')
  assert.match(clean[0].source, /^KI-Vorschlag/)
  assert.equal(clean[1].yearTo, new Date().getUTCFullYear()) // still built
})

test('Searchlight: unknown car is asked once and saved as unreviewed AI data', async (t) => {
  const writes = []
  let stored = null
  t.mock.method(Vehicle, 'findOne', (q) => ({ lean: async () => (stored && q.key === stored.key ? stored : null) }))
  t.mock.method(Vehicle, 'updateOne', async (filter, update) => {
    writes.push([filter, update])
    if (update.$setOnInsert) stored = { ...update.$setOnInsert, fitments: [] }
    if (update.$set?.fitments) stored = { ...stored, fitments: update.$set.fitments, reviewed: false }
    return {}
  })
  t.mock.method(globalThis, 'fetch', async () => reply({ make: 'VW', model: 'Golf', generations: [{ generation: 'Golf 7 (5G)', yearFrom: 2012, yearTo: 2020, sizes: [{ width: '205', height: '55', diameter: '16' }] }] }))
  const v = await service.visitorLookup('Volkswagen', 'Golf 7', '2016')
  assert.equal(v.key, 'vw:golf')
  assert.equal(v.fitments[0].size, '205/55 R16')
  const save = writes.find(([, u]) => u.$set?.fitments)
  assert.deepEqual(save[0].reviewed, { $ne: true }) // never overwrites reviewed data
  assert.equal(save[1].$set['ai.status'], 'filled')
})

/* ------------------------------------------------------------ routes */

const app = express()
app.use(express.json())
app.use('/f', router)
const server = app.listen(0)
const base = `http://127.0.0.1:${server.address().port}/f`
test.after(() => server.close())

test('plans + openapi are public; plans list models by popularity', async () => {
  const p = await (await fetch(`${base}/plans`)).json()
  assert.deepEqual(Object.keys(p.plans), ['free', 'pro', 'advanced'])
  assert.equal(p.plans.advanced.models, null)
  const spec = await (await fetch(`${base}/openapi.json`)).json()
  assert.ok(spec.paths['/vehicles'])
})

test('access request: paid plans need company and address', async (t) => {
  let created = null
  t.mock.method(Access, 'create', async (doc) => { created = doc; return doc })
  const post = (body) => fetch(`${base}/access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const ok = { plan: 'pro', email: 'a@firma.de', name: 'Max', ips: ['8.8.8.8'], acceptedTerms: data.termsVersion }
  assert.equal((await (await post(ok)).json()).field, 'company')
  const r = await post({ ...ok, company: 'Firma GmbH', street: 'Weg 1', zip: '10115', city: 'Berlin', billing: 'yearly', vatId: 'de 123' })
  assert.equal(r.status, 202)
  assert.equal(created.company, 'Firma GmbH')
  assert.equal(created.billing, 'yearly')
  assert.equal(created.vatId, 'DE123')
})

const key = `rfx_${'a'.repeat(64)}`
const hash = createHash('sha256').update(key).digest('hex')

test('v1: plan limits (top-N models, no size search on free, no load index on free)', async (t) => {
  const account = { _id: 'x', plan: 'free', status: 'active', requestedIps: ['8.8.8.8'], keyHash: hash }
  t.mock.method(Access, 'findOne', () => ({ lean: async () => account }))
  t.mock.method(Access, 'findOneAndUpdate', async () => ({ requests: 3 }))
  let lastFilter = null
  t.mock.method(Vehicle, 'find', (f) => {
    lastFilter = f
    return { select: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [
      { make: 'VW', model: 'Golf', key: 'vw:golf', reviewed: false, fitments: [{ size: '205/55 R16', variant: 'Golf 7 (5G)', yearFrom: 2012, yearTo: 2020, axle: 'both', source: 'KI-Vorschlag (x)', loadIndex: '91', speedIndex: 'V' }] },
    ] }) }) }) }) }
  })
  t.mock.method(Vehicle, 'countDocuments', async () => 1)
  // behind our proxy (127.0.0.1 here) the client IP comes from X-Fitment-Client-IP
  process.env.FITMENT_TRUSTED_PROXY_IP = '127.0.0.1'
  const get = (q) => fetch(`${base}/v1/vehicles${q}`, { headers: { authorization: `Bearer ${key}`, 'x-fitment-client-ip': '8.8.8.8' } })

  let r = await get('?make=VW&model=Golf%207&year=2016')
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('x-ratelimit-remaining'), String(plans.free.daily - 3))
  const j = await r.json()
  assert.deepEqual(lastFilter.rank, { $lte: plans.free.models })
  assert.deepEqual(lastFilter.key, { $in: ['vw:golf7', 'vw:golf'] })
  assert.equal(j.vehicles[0].verified, false)
  assert.equal(j.vehicles[0].fitments[0].loadIndex, undefined)
  assert.equal(j.vehicles[0].fitments[0].source, 'reifexa (KI, ungeprüft)')

  r = await get('?size=205/55%20R16')
  assert.equal(r.status, 403)

  account.plan = 'pro'
  r = await get('?size=205/55%20R16')
  assert.equal(r.status, 200)
  assert.equal((await r.json()).vehicles[0].fitments[0].loadIndex, '91')

  account.requestedIps = ['1.1.1.1']
  assert.equal((await get('')).status, 403)
})
