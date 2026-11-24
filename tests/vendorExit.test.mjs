import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import mongoose from 'mongoose'

process.env.AWIN_CLOAK_SECRET = 'test-secret-test-secret-test-sec'
process.env.AWIN_AFFILIATE_ID = '2985775'

const { default: affiliateCloak } = await import('../src/api/utils/affiliateCloak.js')
const { default: router } = await import('../src/api/utils/affiliate.js')

// No database connection: Mongoose would buffer queries for 10 s. The shopper must
// still be redirected to AWIN right away – click logging may never block the exit.
test('vendor exit redirects to AWIN immediately even when the database is unavailable', async () => {
  mongoose.set('bufferTimeoutMS', 3000)
  const app = express()
  app.use(router)
  const server = app.listen(0)
  const port = server.address().port
  const awin = 'https://www.awin1.com/pclick.php?p=123&a=2985775&m=11111'
  const token = affiliateCloak.encodeAffiliateUrl(awin)
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
  const started = Date.now()
  const res = await fetch(
    `http://127.0.0.1:${port}/r/${token}?product=665f1c2b9a1e4b0012345678&vendor=reifen.com&vendorId=11111&from=product-card`,
    { redirect: 'manual', headers: { 'user-agent': ua } }
  )
  const ms = Date.now() - started
  server.close()
  assert.equal(res.status, 302)
  const loc = new URL(res.headers.get('location'))
  assert.equal(loc.hostname, 'www.awin1.com')
  assert.equal(loc.searchParams.get('m'), '11111')
  assert.equal(loc.searchParams.get('a'), '2985775')
  assert.match(loc.searchParams.get('clickref'), /^rx-/)
  assert.ok(ms < 1500, `redirect took ${ms} ms`)
  await new Promise(r => setTimeout(r, 3500)) // let the background log attempt time out
})

test('buildVendorExitTarget: AWIN link keeps publisher, merchant and clickref', async () => {
  process.env.AWIN_AFFILIATE_ID = '2985775'
  const { buildVendorExitTarget } = await import('../src/api/utils/affiliate.js')
  const out = new URL(await buildVendorExitTarget('https://www.awin1.com/pclick.php?p=123&a=2985775&m=13321', { productId: '64b7f0c0ffee000000000001', from: 'produktseite', vendor: 'reifen.de', vendorId: '13321' }))
  assert.equal(out.hostname, 'www.awin1.com')
  assert.equal(out.searchParams.get('a'), '2985775')
  assert.equal(out.searchParams.get('m'), '13321')
  assert.match(out.searchParams.get('clickref'), /^rx-/)
})

test('Giga: the AWIN link is used as it is (no domain rewrite)', async () => {
  process.env.AWIN_AFFILIATE_ID = '2985775'
  const { buildVendorExitTarget } = await import('../src/api/utils/affiliate.js')
  const out = new URL(await buildVendorExitTarget('https://www.awin1.com/pclick.php?p=555&a=2985775&m=9352', { productId: '64b7f0c0ffee000000000001', from: 'produktseite', vendor: 'Giga Tyres EU', vendorId: '9352' }))
  assert.equal(out.pathname, '/pclick.php')
  assert.equal(out.searchParams.get('p'), '555')
  assert.equal(out.searchParams.get('m'), '9352')
  assert.equal(out.searchParams.get('ued'), null)
  assert.match(out.searchParams.get('clickref'), /^rx-/)
})
