import test from 'node:test'
import assert from 'node:assert/strict'
const root = './'
const { parseReifenComPage } = await import(root + 'reifenComLivePrice.js')
const rc = await import(root + 'reifenCom.js')
const { computeOfferStats, dropOutOfStockWhenAlternatives } = await import(root + 'offerPricing.js')
const { isCarTyreGroup } = await import(root + 'validators.js')

const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`

test('json-ld single product price + stock', () => {
  const r = parseReifenComPage(ld({ '@context': 'https://schema.org', '@type': 'Product', name: 'X',
    offers: { '@type': 'Offer', price: '89.90', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' } }))
  assert.equal(r.price, 89.9); assert.equal(r.inStock, true); assert.equal(r.source, 'json-ld')
})
test('json-ld in @graph, German comma, out of stock', () => {
  const r = parseReifenComPage(ld({ '@graph': [{ '@type': 'BreadcrumbList' }, { '@type': ['Product'], offers: [{ '@type': 'Offer', price: '1.234,50', availability: 'OutOfStock' }] }] }))
  assert.equal(r.price, 1234.5); assert.equal(r.inStock, false)
})
test('ignores aggregate offers and multi-product listing pages', () => {
  assert.equal(parseReifenComPage(ld({ '@type': 'Product', offers: { '@type': 'AggregateOffer', lowPrice: 50, highPrice: 90 } })).price, undefined)
  assert.equal(parseReifenComPage(ld({ '@type': 'Product', offers: { price: 50 } }) + ld({ '@type': 'Product', offers: { price: 60 } })).price, undefined)
})
test('microdata main product, ignores nested cross-sell', () => {
  const html = `<div itemscope itemtype="https://schema.org/Product"><meta itemprop="price" content="112.40">
    <link itemprop="availability" href="https://schema.org/InStock">
    <div itemscope itemtype="https://schema.org/Product"><meta itemprop="price" content="59.00"></div></div>`
  const r = parseReifenComPage(html)
  assert.equal(r.price, 112.4); assert.equal(r.inStock, true); assert.equal(r.source, 'microdata')
})
test('no structured price → undefined, never a guess', () => {
  assert.equal(parseReifenComPage('<div class="price">99,00 €</div><span>Versand 4,99 €</span>').price, undefined)
})
test('reifen.com name matching', () => {
  for (const n of ['reifen.com', 'Reifen.com', ' REIFEN.COM ', 'reifen.com DE']) assert.ok(rc.isReifenComName(n), n)
  for (const n of ['reifen DE', 'reifendirekt', 'Tirendo', '']) assert.ok(!rc.isReifenComName(n), n)
  assert.ok(rc.REIFEN_COM_VENDOR_REGEX.test('Reifen.com')); assert.ok(!rc.REIFEN_COM_VENDOR_REGEX.test('reifen DE'))
})
test('reifen.com URL from AWIN link', () => {
  assert.equal(rc.reifenComProductUrl({ original_affiliate_url: 'https://www.awin1.com/pclick.php?a=1&ued=https%3A%2F%2Fwww.reifen.com%2Fde%2Fp%2F123' }), 'https://www.reifen.com/de/p/123')
  assert.equal(rc.reifenComProductUrl({ merchant_deep_link: '/de/p/9' }), 'https://www.reifen.com/de/p/9')
})
test('reifen.com listed first, kept when out of stock, default vendor set, cheapest still honest', () => {
  const offers = [
    { vendor: 'Tirendo', price: 80, in_stock: true },
    { vendor: 'reifen.com', price: 90, in_stock: false },
    { vendor: 'Other', price: 70, in_stock: false },
  ]
  const kept = dropOutOfStockWhenAlternatives(offers)
  assert.deepEqual(kept.map((o) => o.vendor).sort(), ['Tirendo', 'reifen.com'])
  const s = computeOfferStats(kept)
  assert.equal(s.offers[0].vendor, 'reifen.com')
  assert.equal(s.default_vendor.vendor, 'reifen.com'); assert.equal(s.reifen_com_price, 90)
  assert.equal(s.cheapest_vendor.vendor, 'Tirendo')
})
test('price tie goes to reifen.com', () => {
  const s = computeOfferStats([{ vendor: 'A', price: 90 }, { vendor: 'reifen.com', price: 90 }])
  assert.equal(s.cheapest_vendor.vendor, 'reifen.com')
})
test('car-tyre group needs a reifen.com row in category Reifen', () => {
  const r = (m, c2, c3) => ({ merchant_name: m, merchant_product_second_category: c2, merchant_product_third_category: c3 })
  assert.ok(isCarTyreGroup([r('Reifen.com', 'Reifen', 'Sommerreifen'), r('X', '', '')]))
  assert.ok(!isCarTyreGroup([r('reifen.com', 'Felgen', 'Alu'), r('X', 'Reifen', 'Sommer')]))
})
