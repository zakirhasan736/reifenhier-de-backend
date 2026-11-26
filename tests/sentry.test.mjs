import test from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
const { scrubEvent, sentryEnabled } = await import('../src/instrument.js')

test('sentry stays off in tests / without a DSN', () => {
  assert.equal(sentryEnabled, false)
})

test('scrubEvent removes cookies, auth headers, e-mails and user details', () => {
  const out = scrubEvent({
    request: {
      cookies: { uuid: 'x' },
      headers: { cookie: 'a=b', authorization: 'Bearer t', 'user-agent': 'UA' },
      data: '{"email":"max@example.de","size":"205/55 R16"}',
    },
    user: { id: 'u1', email: 'max@example.de', ip_address: '1.2.3.4' },
  })
  assert.equal(out.request.cookies, undefined)
  assert.deepEqual(out.request.headers, { 'user-agent': 'UA' })
  assert.ok(!out.request.data.includes('max@example.de'))
  assert.ok(out.request.data.includes('205/55 R16'))
  assert.deepEqual(out.user, { id: 'u1' })
})
