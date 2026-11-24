#!/usr/bin/env node
/**
 * Compare two MongoDB databases collection by collection:
 * number of documents and index names. Used after the copy from Atlas.
 *
 *   SOURCE_URI=<atlas> TARGET_URI=<local> node scripts/mongo-selfhost/verify-copy.mjs
 *
 * Exit code 0 = everything matches, 1 = something differs.
 */
import { MongoClient } from 'mongodb'

const { SOURCE_URI, TARGET_URI, SOURCE_DB, TARGET_DB } = process.env
if (!SOURCE_URI || !TARGET_URI) {
  console.error('SOURCE_URI and TARGET_URI are required')
  process.exit(2)
}

const src = new MongoClient(SOURCE_URI)
const dst = new MongoClient(TARGET_URI)
await Promise.all([src.connect(), dst.connect()])
const a = src.db(SOURCE_DB || undefined)
const b = dst.db(TARGET_DB || SOURCE_DB || undefined)

const names = (await a.listCollections({ type: 'collection' }).toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith('system.'))
  .sort()

let bad = 0
console.log(`Source ${a.databaseName} → target ${b.databaseName} · ${names.length} collections\n`)
console.log('collection'.padEnd(28), 'source'.padStart(10), 'target'.padStart(10), ' indexes')
for (const n of names) {
  const [ca, cb] = await Promise.all([a.collection(n).countDocuments(), b.collection(n).countDocuments()])
  const ia = (await a.collection(n).indexes()).map((i) => i.name).sort()
  const ib = (await b.collection(n).indexes().catch(() => [])).map((i) => i.name).sort()
  const missing = ia.filter((x) => !ib.includes(x))
  const ok = ca === cb && missing.length === 0
  if (!ok) bad++
  console.log(
    `${ok ? '✔' : '✖'} ${n}`.padEnd(28),
    String(ca).padStart(10),
    String(cb).padStart(10),
    missing.length ? ` missing: ${missing.join(', ')}` : ` ${ia.length} ok`
  )
}
await Promise.all([src.close(), dst.close()])
console.log(bad ? `\n✖ ${bad} collection(s) differ` : '\n✔ All collections and indexes match')
process.exit(bad ? 1 : 0)
