import test from 'node:test'
import assert from 'node:assert/strict'

process.env.AWIN_CLOAK_SECRET = 'test-secret-test-secret-test-sec'
process.env.AWIN_AFFILIATE_ID = '2985775'

const { default: affiliateCloak } = await import('../src/api/utils/affiliateCloak.js')
const { checkExitUrl, getTrackingCheck } = await import('../src/api/adminAlerts/trackingCheck.js')
const { default: Product } = await import('../src/models/product.js')
const { default: Click } = await import('../src/models/click.js')
const { default: AwinTransaction } = await import('../src/models/awinTransaction.js')

const tok = url => affiliateCloak.encodeAffiliateUrl(url)
const good = m => tok(`https://www.awin1.com/pclick.php?p=4242&a=2985775&m=${m}`)

test('checkExitUrl accepts a correct AWIN product link', () => {
  const r = checkExitUrl(good('12345'), { vendorId: '12345', productId: 'p1', expectedA: '2985775' })
  assert.equal(r.ok, true, JSON.stringify(r))
})

test('checkExitUrl flags wrong publisher id, advertiser mismatch, non-AWIN links and bad tokens', () => {
  assert.deepEqual(
    checkExitUrl(tok('https://www.awin1.com/pclick.php?p=1&a=999&m=12345'), { vendorId: '12345', expectedA: '2985775' }).problems,
    ['publisher_id_wrong:999']
  )
  assert.ok(
    checkExitUrl(good('777'), { vendorId: '12345', expectedA: '2985775' }).problems.includes('advertiser_id_mismatch:777')
  )
  assert.ok(checkExitUrl(tok('https://shop.example/reifen'), { vendorId: '1', expectedA: '2985775' }).problems.includes('not_awin_link'))
  assert.deepEqual(checkExitUrl('garbage', { vendorId: '1' }).problems, ['token_not_decodable'])
  // missing a is filled in from AWIN_AFFILIATE_ID, exactly like the live redirect
  assert.equal(checkExitUrl(tok('https://www.awin1.com/pclick.php?p=1&m=5'), { vendorId: '5', expectedA: '2985775' }).ok, true)
})

test('getTrackingCheck merges links, clicks and sales per vendor', async () => {
  Product.aggregate = async () => [
    { _id: { id: '111', name: 'reifen DE' }, offers: 3, withToken: 3, samples: [{ t: good('111'), p: 'a' }, { t: good('111'), p: 'b' }] },
    { _id: { id: '222', name: 'Shop Zwei' }, offers: 2, withToken: 2, samples: [{ t: good('222'), p: 'c' }] },
    { _id: { id: '333', name: 'Kaputt' }, offers: 1, withToken: 1, samples: [{ t: good('999'), p: 'd' }] },
  ]
  Click.aggregate = async () => [{ _id: '111', clicks: 100, last: new Date() }, { _id: '222', clicks: 40, last: new Date() }]
  AwinTransaction.aggregate = async () => [
    { _id: '111', sales: 7, declined: 0, commission: 21.5, last: new Date(), withClickRef: 7 },
    { _id: '555', sales: 1, declined: 0, commission: 2, last: new Date(), withClickRef: 0 },
  ]
  AwinTransaction.findOne = () => ({ sort: () => ({ select: () => ({ lean: async () => ({ createdAt: new Date(), source: 'webhook' }) }) }) })

  const r = await getTrackingCheck(30)
  const by = Object.fromEntries(r.vendors.map(v => [v.vendorId, v]))
  assert.equal(by['111'].status, 'ok')
  assert.equal(by['111'].conversionPct, 7)
  assert.equal(by['222'].status, 'warning') // 40 clicks, no sale yet
  assert.equal(by['333'].status, 'error')
  assert.ok(by['333'].problems['advertiser_id_mismatch:999'])
  assert.deepEqual(r.otherSales, [{ merchantId: '555', sales: 1 }])
  assert.equal(r.totals.sales, 8)
  assert.equal(r.config.publisherId, '2985775')
})
