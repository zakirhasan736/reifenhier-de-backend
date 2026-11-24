import test from 'node:test'
import assert from 'node:assert/strict'
import { hiddenSwissGiga } from '../src/api/utils/gigaShop.js'

const swiss = { vendor: 'Giga Tyres EU', vendor_id: '9352', currency: 'CHF', merchant_deep_link: 'https://giga-reifen.ch/product/AB1' }
const swissNoCurrency = { vendor: 'Giga Tyres EU', vendor_id: '9352', merchant_deep_link: 'https://giga-reifen.ch/product/AB1' }
const german = { vendor: 'Giga Tyres EU', vendor_id: '9352', currency: 'EUR', merchant_deep_link: 'https://www.giga-reifen.de/product/AB1' }
const other = { vendor: 'reifen.de', vendor_id: '13321', currency: 'EUR' }

test('Swiss Giga offers are hidden by default (also giga-reifen.ch without www)', () => {
  delete process.env.SHOW_SWISS_GIGA
  assert.equal(hiddenSwissGiga(swiss), true)
  assert.equal(hiddenSwissGiga(swissNoCurrency), true)
  assert.equal(hiddenSwissGiga(german), false)
  assert.equal(hiddenSwissGiga(other), false)
})

test('SHOW_SWISS_GIGA=true shows them again', () => {
  process.env.SHOW_SWISS_GIGA = 'true'
  assert.equal(hiddenSwissGiga(swiss), false)
  delete process.env.SHOW_SWISS_GIGA
})
