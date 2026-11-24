import test from 'node:test'
import assert from 'node:assert/strict'

process.env.AWIN_AFFILIATE_ID = '2985775'
const { default: Product } = await import('../src/models/product.js')
const { germanGigaExitUrl, buildVendorExitTarget } = await import('../src/api/utils/affiliate.js')
const { withGermanGigaFeed } = await import('../src/api/utils/awinFeedDownload.js')

const lean = (v) => ({ lean: async () => v })

test('cread link with ued=.ch → same link, landing on giga-reifen.de', async () => {
  const out = new URL(await germanGigaExitUrl('https://www.awin1.com/cread.php?awinmid=9352&awinaffid=2985775&ued=https%3A%2F%2Fwww.giga-reifen.ch%2Fproduct%2FAB123%3FCountry%3DCH'))
  assert.equal(out.searchParams.get('awinmid'), '9352')
  assert.equal(out.searchParams.get('ued'), 'https://www.giga-reifen.de/product/AB123?Country=DE')
})

test('pclick product link: Swiss offer on the product → AWIN link to the .de product', async (t) => {
  t.mock.method(Product, 'findById', () => lean({ offers: [
    { vendor: 'reifen.de', vendor_id: '13321', aw_product_id: '1' },
    { vendor: 'Giga Tyres EU', vendor_id: '9352', aw_product_id: '555', merchant_deep_link: 'https://www.giga-reifen.ch/product/XY9?Country=CH' },
  ] }))
  const out = new URL(await germanGigaExitUrl('https://www.awin1.com/pclick.php?p=555&a=2985775&m=9352', '64b7f0c0ffee000000000001'))
  assert.equal(out.pathname, '/cread.php')
  assert.equal(out.searchParams.get('awinmid'), '9352')
  assert.equal(out.searchParams.get('awinaffid'), '2985775')
  assert.equal(out.searchParams.get('ued'), 'https://www.giga-reifen.de/product/XY9?Country=DE')
})

test('pclick product link of the German feed stays as it is', async (t) => {
  t.mock.method(Product, 'findById', () => lean({ offers: [{ vendor_id: '9352', aw_product_id: '777', merchant_deep_link: 'https://www.giga-reifen.de/product/XY9' }] }))
  const link = 'https://www.awin1.com/pclick.php?p=777&a=2985775&m=9352'
  assert.equal(await germanGigaExitUrl(link, '64b7f0c0ffee000000000001'), link)
})

test('full exit link for Giga keeps publisher, merchant and clickref', async (t) => {
  t.mock.method(Product, 'findById', () => lean({ offers: [{ vendor_id: '9352', aw_product_id: '555', merchant_deep_link: 'https://giga-reifen.ch/product/XY9' }] }))
  const out = new URL(await buildVendorExitTarget('https://www.awin1.com/pclick.php?p=555&a=2985775&m=9352', { productId: '64b7f0c0ffee000000000001', from: 'produktseite', vendor: 'Giga Tyres EU', vendorId: '9352' }))
  assert.equal(out.searchParams.get('awinmid'), '9352')
  assert.match(out.searchParams.get('ued'), /^https:\/\/www\.giga-reifen\.de\//)
  assert.match(out.searchParams.get('clickref'), /^rx-/)
})

test('import: a selected Giga feed brings the other joined Giga feed (German shop)', () => {
  const list = [
    { 'Feed ID': '1', 'Advertiser Name': 'reifen.de', 'Membership Status': 'active' },
    { 'Feed ID': '2', 'Advertiser Name': 'Giga Tyres EU', 'Feed Name': 'giga-reifen.ch', 'Membership Status': 'active' },
    { 'Feed ID': '3', 'Advertiser Name': 'Giga Tyres EU', 'Feed Name': 'giga-reifen.de', 'Membership Status': 'active' },
    { 'Feed ID': '4', 'Advertiser Name': 'Giga Tyres EU', 'Feed Name': 'giga-reifen.at', 'Membership Status': 'not joined' },
  ]
  const ids = (f) => f.map((x) => x['Feed ID'])
  assert.deepEqual(ids(withGermanGigaFeed([list[0], list[1]], list)), ['1', '2', '3'])
  assert.deepEqual(ids(withGermanGigaFeed([list[0]], list)), ['1'])
  const logs = []
  withGermanGigaFeed([list[1]], [list[1]], (m) => logs.push(m))
  assert.match(logs[0], /Only a Swiss Giga feed/)
})
