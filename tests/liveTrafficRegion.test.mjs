import test from 'node:test'
import assert from 'node:assert/strict'

test('live map: city → coordinates + state name', async () => {
  const { __test } = await import('../src/api/traffic/liveTraffic.js')
  const { default: cities } = await import('all-the-cities')
  const p = __test.cityPoint(cities, 'DE', 'Hannover')
  assert.ok(Math.abs(p[0] - 52.37) < 0.1 && Math.abs(p[1] - 9.73) < 0.1)
  assert.equal(__test.cityRegion('DE', 'Hannover'), 'Niedersachsen')
  assert.equal(__test.cityRegion('DE', 'Munich'), 'Bayern')
  assert.equal(__test.cityRegion('CH', 'Zürich'), 'Zürich')
  assert.equal(__test.cityRegion('FR', 'Paris'), '') // only DE/AT/CH
})
