import test from 'node:test'
import assert from 'node:assert/strict'
import app from '../src/app.js'
import mongoose from 'mongoose'

test('production Express app routes review submissions, summaries and protected moderation', async t => {
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}`
  const review = mongoose.model('SiteReview')
  const save = t.mock.method(review, 'create', async data => data)
  t.mock.method(review, 'aggregate', async pipeline => {
    assert.deepEqual(pipeline[0].$match, { kind: 'satisfaction', published: true })
    return []
  })
  const post = body => fetch(base + '/api/reviews', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const summary = await fetch(base + '/api/reviews/summary')
  assert.equal(summary.status, 200)
  assert.deepEqual(await summary.json(), { count: 0, average: null })
  assert.equal((await post({})).status, 400)
  assert.equal(save.mock.callCount(), 0)
  for (const kind of ['bug', 'satisfaction']) {
    const response = await post({ kind, rating: 4, message: ' Test ', published: true })
    assert.equal(response.status, 201)
    assert.deepEqual(await response.json(), { received: true })
    assert.deepEqual(save.mock.calls.at(-1).arguments[0], { kind, rating: 4, message: 'Test' })
  }
  assert.equal((await fetch(base + '/api/admin/reviews')).status, 401)
})
