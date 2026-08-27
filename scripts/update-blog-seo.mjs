/**
 * Refresh blog tags / 2025 leftovers. Does not change slugs.
 * Usage: node scripts/update-blog-seo.mjs
 */
import dotenv from 'dotenv'
import mongoose from 'mongoose'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '..', '.env') })

const TAGS = {
  'sommerreifen-bei-hitze-2026-warum-die-richtige-mischung-sicherheit-bringt': [
    'Sommerreifen',
    'Hitze',
    'Reifenmischung',
    'Fahrsicherheit',
    'Sommerreifen Test 2026',
    'Reifenpreisvergleich',
    'Autoreifen',
    'Reifen kaufen',
    'Reifexa',
  ],
  'sommerreifen-profiltiefe-lagerung-und-reifendruck-2026': [
    'Sommerreifen',
    'Profiltiefe',
    'Reifendruck',
    'Reifenlagerung',
    'Reifenpflege',
    'Profiltiefe Gesetz',
    'Reifen Ratgeber 2026',
    'Reifenpreisvergleich',
    'Reifexa',
  ],
  'sommerreifen-test-2026-nasshaftung-eu-label-und-modellvergleich': [
    'Sommerreifen Test 2026',
    'Nasshaftung',
    'EU-Reifenlabel',
    'Reifen Vergleich',
    'Preisvergleich',
    'Sommerreifen kaufen',
    'Reifen Händler vergleichen',
    'Reifexa',
  ],
  'sommerreifen-wechseln-2026-zeitpunkt-groesse-und-reifensuche': [
    'Sommerreifen wechseln',
    'Reifengröße',
    'Reifenrechner',
    'Reifenwechsel 2026',
    'O bis O Regel',
    'Reifen kaufen',
    'Preisvergleich',
    'Reifexa',
  ],
  'reifenrechner-2026-preise-vergleichen-modelle-pruefen-und-die-richtige-reifengroesse-finden': [
    'Reifenrechner',
    'Reifengröße finden',
    'Preisvergleich',
    'Reifen Suche',
    '205/55 R16',
    'Reifen online vergleichen',
    'Reifen kaufen Deutschland',
    'Reifexa',
  ],
  'sommerreifen-vs-ganzjahresreifen-was-ist-die-bessere-wahl-2025': [
    'Sommerreifen',
    'Ganzjahresreifen',
    'Allwetterreifen',
    'Sommerreifen vs Ganzjahresreifen',
    'Reifen Vergleich 2026',
    'Reifen Test',
    'Reifen kaufen',
    'Preisvergleich',
    'Reifexa',
  ],
  'eu-reifenlabel-verstehen-worauf-sollte-man-beim-reifenkauf-achten-2025': [
    'EU-Reifenlabel',
    'Rollwiderstand',
    'Nasshaftung',
    'Rollgeräusch',
    'Effizienzklasse',
    'Verordnung 2020/740',
    'Reifen kaufen',
    'Reifen Test 2026',
    'Preisvergleich',
    'Reifexa',
  ],
  'die-haufigsten-fehler-beim-reifenkauf-und-wie-sie-sie-vermeiden': [
    'Reifenkauf Fehler',
    'Reifen Ratgeber',
    'Reifengröße',
    'Lastindex',
    'Speedindex',
    'Preisvergleich',
    'Reifen kaufen',
    'Reifen Test 2026',
    'Reifexa',
  ],
}

function walkReplace(value) {
  if (typeof value === 'string') return value.replace(/2025/g, '2026')
  if (Array.isArray(value)) return value.map(walkReplace)
  if (value && typeof value === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = walkReplace(v)
    return out
  }
  return value
}

await mongoose.connect(process.env.MONGODB_URI)
const col = mongoose.connection.collection('blogs')
const blogs = await col.find({}).toArray()

let updated = 0
for (const blog of blogs) {
  const next = {
    title: walkReplace(blog.title),
    metaDescription: walkReplace(blog.metaDescription),
    contentBlocks: walkReplace(blog.contentBlocks),
    tags: TAGS[blog.slug] || Array.from(
      new Set([...(blog.tags || []), 'Ratgeber', 'Reifenpreisvergleich', 'Reifexa', '2026'])
    ),
  }
  const sameTitle = next.title === blog.title
  const sameMeta = next.metaDescription === blog.metaDescription
  const sameTags = JSON.stringify(next.tags) === JSON.stringify(blog.tags)
  if (sameTitle && sameMeta && sameTags) continue
  await col.updateOne(
    { _id: blog._id },
    {
      $set: {
        title: next.title,
        metaDescription: next.metaDescription,
        contentBlocks: next.contentBlocks,
        tags: next.tags,
        updatedAt: new Date(),
      },
    }
  )
  updated += 1
  console.log('updated', blog.slug, 'tags', next.tags.length)
}

console.log(`done ${updated}/${blogs.length}`)
await mongoose.disconnect()
