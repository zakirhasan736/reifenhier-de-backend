// Run from the same VPS as PM2. An empty submission validates routing without writing data.
import '../src/loadEnv.js'

const base = process.env.REIFEXA_REVIEW_CHECK_URL || `http://127.0.0.1:${process.env.PORT || 8004}`
for (let attempt = 1; attempt <= 8; attempt++) {
  try {
    const summary = await fetch(new URL('/api/reviews/summary', base), { signal: AbortSignal.timeout(5000) })
    if (summary.status !== 200) throw new Error(`summary returned HTTP ${summary.status}`)
    const { count, average } = await summary.json()
    if (!Number.isInteger(count) || count < 0 || !(count === 0 ? average === null : average >= 1 && average <= 5)) {
      throw new Error('unexpected review summary')
    }
    const submission = await fetch(new URL('/api/reviews', base), {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      signal: AbortSignal.timeout(5000),
    })
    if (submission.status !== 400 || (await submission.json()).error !== 'invalid_review') {
      throw new Error(`submission check returned HTTP ${submission.status}`)
    }
    console.log('Review API ready: MongoDB summary read succeeded and empty submission was rejected.')
    break
  } catch (error) {
    if (attempt === 8) throw error
    await new Promise(resolve => setTimeout(resolve, 1500))
  }
}
