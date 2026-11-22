import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { classifySource } from '../src/api/traffic/classifySource.js'

const c = (referrer, utmSource = '', utmMedium = '') => classifySource({ referrer, utmSource, utmMedium })

test('AI assistants', () => {
  assert.deepEqual([c('https://chatgpt.com/').source, c('https://chatgpt.com/').channel], ['ChatGPT', 'ai'])
  assert.equal(c('', 'chatgpt.com').source, 'ChatGPT') // ChatGPT link with utm_source, no referrer
  assert.equal(c('https://www.perplexity.ai/search/abc').source, 'Perplexity')
  assert.equal(c('https://claude.ai/chat/1').source, 'Claude')
  assert.equal(c('https://gemini.google.com/app').source, 'Gemini') // not "Google"
  assert.equal(c('https://copilot.microsoft.com/').source, 'Copilot')
  assert.equal(c('https://grok.com/').source, 'Grok')
  assert.equal(c('https://chat.deepseek.com/').source, 'DeepSeek')
})

test('search engines, social, referral, direct, internal, paid', () => {
  assert.deepEqual([c('https://www.google.de/').source, c('https://www.google.de/').channel], ['Google', 'search'])
  assert.equal(c('https://www.bing.com/search?q=reifen').source, 'Bing')
  assert.equal(c('https://duckduckgo.com/').source, 'DuckDuckGo')
  assert.equal(c('https://www.ecosia.org/search').source, 'Ecosia')
  assert.equal(c('https://l.facebook.com/').channel, 'social')
  assert.equal(c('https://www.youtube.com/').source, 'YouTube')
  assert.deepEqual([c('https://www.motor-talk.de/forum').channel], ['social'])
  assert.deepEqual([c('https://some-blog.de/post').channel, c('https://some-blog.de/post').source], ['referral', 'some-blog.de'])
  assert.equal(c('').channel, 'direct')
  assert.equal(c('https://www.reifexa.de/reifen').channel, 'internal')
  assert.equal(c('https://www.google.de/', 'google', 'cpc').channel, 'paid')
})

test('POST /visit classifies, ignores bots and never needs a cookie', async () => {
  const { default: router } = await import('../src/api/traffic/traffic.routes.js')
  const { default: TrafficVisit } = await import('../src/models/trafficVisit.js')
  const stored = []
  TrafficVisit.create = async doc => stored.push(doc)
  const app = express()
  app.use(express.json())
  app.use('/api/traffic', router)
  const server = app.listen(0)
  const base = `http://127.0.0.1:${server.address().port}/api/traffic/visit`
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
  const post = (body, agent = ua) =>
    fetch(base, { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': agent }, body: JSON.stringify(body) }).then(r => r.json())

  const r1 = await post({ referrer: 'https://chatgpt.com/', landing: '/produkte/hankook-kinergy-4s2?utm_source=chatgpt.com', utm_source: 'chatgpt.com' })
  assert.deepEqual([r1.source, r1.channel, r1.stored], ['ChatGPT', 'ai', true])
  const r2 = await post({ referrer: 'https://www.google.de/' }, 'Googlebot/2.1 (+http://www.google.com/bot.html)')
  assert.equal(r2.stored, false)
  const r3 = await post({ referrer: 'https://www.reifexa.de/reifen' })
  assert.equal(r3.stored, false)
  await new Promise(r => setTimeout(r, 50))
  server.close()
  assert.equal(stored.length, 1)
  assert.equal(stored[0].productSlug, 'hankook-kinergy-4s2')
  assert.equal(stored[0].landingPath, '/produkte/hankook-kinergy-4s2')
  assert.equal(stored[0].device, 'mobile')
  assert.equal(stored[0].ip, undefined)
})
