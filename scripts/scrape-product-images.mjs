/**
 * Pull product images from the shops' product pages for products that still
 * have no working image (AWIN feed had none, or every AWIN image URL failed).
 *
 * For each such product it opens the shop pages from offers[].merchant_deep_link
 * (the shop's own URL — never the AWIN click link, so no fake clicks), reads the
 * main image (og:image, JSON-LD Product.image, itemprop=image, image_src),
 * downloads it, converts it to WebP and saves it like the daily image job:
 *   /images/product-image/<year>/<month>/<name>-<ean>.webp
 *
 * Usage (on the VPS, in the backend folder):
 *   node scripts/scrape-product-images.mjs --dry-run          # report only, change nothing
 *   node scripts/scrape-product-images.mjs                    # fix all products without an image
 *   node scripts/scrape-product-images.mjs --limit 200        # first 200 only
 *   node scripts/scrape-product-images.mjs --vendor reifen.com
 *   node scripts/scrape-product-images.mjs --ean 6953913151304
 *
 * A CSV report is written to tmp/scrape-product-images-<timestamp>.csv.
 */
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'
import axios from 'axios'
import * as cheerio from 'cheerio'
import sharp from 'sharp'
import { imageRoots } from '../src/api/utils/imageRoots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })
process.chdir(path.join(__dirname, '..')) // image folders resolve from backend root

// ---------- options ----------
const args = process.argv.slice(2)
const opt = (name) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}
const DRY_RUN = args.includes('--dry-run')
const LIMIT = Number(opt('limit') || 0)
const ONLY_VENDOR = String(opt('vendor') || '').toLowerCase()
const ONLY_EAN = String(opt('ean') || '').trim()
const CONCURRENCY = Number(opt('concurrency') || process.env.SCRAPE_CONCURRENCY || 4)
const HOST_DELAY_MS = Number(opt('delay') || process.env.SCRAPE_HOST_DELAY_MS || 1500)
const MIN_SIDE = Number(process.env.MIN_IMAGE_SIDE || 100)
const PREFERRED_VENDOR = 'reifen.com' // site's priority vendor: try its page first

if (!process.env.MONGODB_URI) {
  console.error('Missing MONGODB_URI')
  process.exit(1)
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
const ROOTS = imageRoots({ create: true })
const now = new Date()
const YEAR = String(now.getFullYear())
const MONTH = String(now.getMonth() + 1).padStart(2, '0')

// ---------- helpers ----------
const slugify = (t) =>
  String(t || 'product')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40) || 'product'

const isHttp = (u) => /^https?:\/\//i.test(String(u || ''))
const hostOf = (u) => {
  try { return new URL(u).hostname.toLowerCase() } catch { return '' }
}

function localFileOk(rel) {
  const relative = String(rel || '').replace(/^\/images\//, '')
  return ROOTS.some((root) => {
    try {
      const st = fs.statSync(path.join(root, relative))
      return st.isFile() && st.size > 0
    } catch { return false }
  })
}

/** Does this product currently have an image the site can show? */
function hasWorkingImage(p) {
  const img = String(p.product_image || '')
  if (img.startsWith('/images/product-image/')) return localFileOk(img)
  return false // remote or empty → the daily job couldn't download it
}

// One request at a time per shop, with a pause, so we never hammer a shop.
const hostQueues = new Map()
function throttled(host, fn) {
  const prev = hostQueues.get(host) || Promise.resolve()
  const next = prev
    .catch(() => {})
    .then(fn)
    .finally(() => new Promise((r) => setTimeout(r, HOST_DELAY_MS)))
  hostQueues.set(host, next.catch(() => {}))
  return next
}

const BAD_IMAGE = /(logo|placeholder|no[-_]?image|noimage|dummy|sprite|icon|favicon|blank|default[-_]?image|spacer|pixel)/i

/** All image URLs a product page advertises, best first. */
function extractImages(html, pageUrl) {
  const $ = cheerio.load(html)
  const found = []
  const add = (v) => {
    const raw = String(v || '').trim()
    if (!raw || raw.startsWith('data:')) return
    try {
      const abs = new URL(raw, pageUrl).toString()
      if (!found.includes(abs) && !BAD_IMAGE.test(abs)) found.push(abs)
    } catch { /* ignore */ }
  }

  // 1. JSON-LD Product.image — the most reliable on shop pages
  $('script[type="application/ld+json"]').each((_, el) => {
    let data
    try { data = JSON.parse($(el).contents().text()) } catch { return }
    const stack = Array.isArray(data) ? [...data] : [data]
    while (stack.length) {
      const node = stack.shift()
      if (!node || typeof node !== 'object') continue
      if (Array.isArray(node['@graph'])) stack.push(...node['@graph'])
      const type = [].concat(node['@type'] || []).join(' ')
      if (/Product/i.test(type) && node.image) {
        for (const img of [].concat(node.image)) {
          add(typeof img === 'string' ? img : img?.url || img?.contentUrl)
        }
      }
    }
  })
  // 2. Open Graph / Twitter
  add($('meta[property="og:image:secure_url"]').attr('content'))
  add($('meta[property="og:image"]').attr('content'))
  add($('meta[name="og:image"]').attr('content'))
  add($('meta[name="twitter:image"]').attr('content'))
  // 3. Microdata / legacy
  $('[itemprop="image"]').each((_, el) => add($(el).attr('content') || $(el).attr('src') || $(el).attr('href')))
  add($('link[rel="image_src"]').attr('href'))
  return found
}

async function fetchPage(url) {
  const res = await axios.get(url, {
    timeout: 20000,
    maxRedirects: 5,
    responseType: 'text',
    maxContentLength: 8 * 1024 * 1024,
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'de-DE,de;q=0.9' },
    validateStatus: (s) => s >= 200 && s < 400,
  })
  return { html: String(res.data || ''), finalUrl: res.request?.res?.responseUrl || url }
}

async function downloadImage(url, referer) {
  const res = await axios.get(url, {
    timeout: 20000,
    maxRedirects: 5,
    responseType: 'arraybuffer',
    maxContentLength: 30 * 1024 * 1024,
    headers: { 'User-Agent': UA, Accept: 'image/avif,image/webp,image/*,*/*;q=0.8', Referer: referer },
    validateStatus: (s) => s >= 200 && s < 400,
  })
  const ctype = String(res.headers['content-type'] || '').toLowerCase()
  if (ctype && !ctype.startsWith('image/') && !ctype.includes('octet-stream')) {
    throw new Error(`not an image (${ctype})`)
  }
  const buf = Buffer.from(res.data)
  const meta = await sharp(buf).metadata()
  if (!meta.width || !meta.height || Math.min(meta.width, meta.height) < MIN_SIDE) {
    throw new Error(`too small (${meta.width}x${meta.height})`)
  }
  return sharp(buf).webp({ quality: Number(process.env.WEBP_QUALITY || 85) }).toBuffer()
}

function saveWebp(buf, filename) {
  let written = 0
  for (const root of ROOTS) {
    try {
      const dir = path.join(root, 'product-image', YEAR, MONTH)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, filename), buf)
      written++
    } catch (err) {
      console.warn('  could not write to', root, err?.message)
    }
  }
  if (!written) throw new Error('could not write image to any folder')
  return `/images/product-image/${YEAR}/${MONTH}/${filename}`
}

/** Shop pages for this product, priority vendor and in-stock offers first. */
function shopPages(p) {
  const offers = (Array.isArray(p.offers) ? p.offers : [])
    .filter((o) => isHttp(o?.merchant_deep_link))
    .filter((o) => !ONLY_VENDOR || String(o.vendor || '').toLowerCase().includes(ONLY_VENDOR))
    .sort(
      (a, b) =>
        Number(!String(a.vendor || '').toLowerCase().includes(PREFERRED_VENDOR)) -
          Number(!String(b.vendor || '').toLowerCase().includes(PREFERRED_VENDOR)) ||
        Number(a.in_stock === false) - Number(b.in_stock === false)
    )
  const urls = offers.map((o) => ({ url: o.merchant_deep_link, vendor: o.vendor || hostOf(o.merchant_deep_link) }))
  if (!ONLY_VENDOR && isHttp(p.merchant_deep_link)) urls.push({ url: p.merchant_deep_link, vendor: 'feed' })
  const seen = new Set()
  return urls.filter((u) => (seen.has(u.url) ? false : seen.add(u.url)))
}

// ---------- main ----------
await mongoose.connect(process.env.MONGODB_URI)
const col = mongoose.connection.db.collection('products')

const query = ONLY_EAN ? { ean: ONLY_EAN } : {}
const cursor = col.find(query, {
  projection: { ean: 1, product_name: 1, product_image: 1, merchant_deep_link: 1, 'offers.vendor': 1, 'offers.merchant_deep_link': 1, 'offers.in_stock': 1 },
})

const targets = []
for await (const p of cursor) {
  if (!ONLY_EAN && hasWorkingImage(p)) continue
  if (!shopPages(p).length) continue
  targets.push(p)
  if (LIMIT && targets.length >= LIMIT) break
}
console.log(`🖼️  Products without a working image that have shop pages: ${targets.length}${DRY_RUN ? '  (dry run)' : ''}`)
console.log(`📁 Saving to: ${ROOTS.join(' | ')}`)

const report = [['ean', 'status', 'vendor', 'page_url', 'image_url', 'saved_as', 'note']]
let fixed = 0, failed = 0, done = 0
let idx = 0

async function handle(p) {
  const ean = String(p.ean || p._id)
  const filename = `${slugify(p.product_name)}-${String(p.ean || p._id).replace(/[^a-z0-9]/gi, '')}.webp`
  const notes = []
  for (const { url, vendor } of shopPages(p)) {
    const host = hostOf(url)
    try {
      const { html, finalUrl } = await throttled(host, () => fetchPage(url))
      const images = extractImages(html, finalUrl)
      if (!images.length) { notes.push(`${vendor}: no image on page`); continue }
      for (const img of images.slice(0, 4)) {
        try {
          if (DRY_RUN) {
            report.push([ean, 'would-fix', vendor, url, img, '', ''])
            return true
          }
          const webp = await throttled(hostOf(img), () => downloadImage(img, finalUrl))
          const rel = saveWebp(webp, filename)
          await col.updateOne(
            { _id: p._id },
            { $set: { product_image: rel, scraped_image_url: img, scraped_image_page: url, scraped_image_at: new Date() } }
          )
          report.push([ean, 'fixed', vendor, url, img, rel, ''])
          return true
        } catch (err) {
          notes.push(`${vendor}: ${err?.message || err}`)
        }
      }
    } catch (err) {
      notes.push(`${vendor}: page ${err?.response?.status || err?.message || err}`)
    }
  }
  report.push([ean, 'failed', '', '', '', '', notes.join(' | ').slice(0, 500)])
  return false
}

async function worker() {
  while (idx < targets.length) {
    const p = targets[idx++]
    const ok = await handle(p).catch(() => false)
    ok ? fixed++ : failed++
    done++
    if (done % 25 === 0 || done === targets.length) {
      console.log(`[${done}/${targets.length}] ${DRY_RUN ? 'found' : 'fixed'}: ${fixed}  failed: ${failed}`)
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker))

fs.mkdirSync(path.join(process.cwd(), 'tmp'), { recursive: true })
const csvPath = path.join(process.cwd(), 'tmp', `scrape-product-images-${Date.now()}.csv`)
const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
fs.writeFileSync(csvPath, report.map((r) => r.map(esc).join(',')).join('\n'))

console.log(`\n✅ Done. ${DRY_RUN ? 'Would fix' : 'Fixed'}: ${fixed}  Failed: ${failed}  Total: ${targets.length}`)
console.log(`📄 Report: ${csvPath}`)
await mongoose.disconnect()
