/**
 * AWIN click URL helpers.
 *
 * Feed download uses cid (campaign) in AWIN_CSV_URL.
 * Product clickouts use pclick.php:
 *   a  = publisher / affiliate id (commission account)
 *   m  = merchant / advertiser id (exact vendor)
 *   p  = AWIN product id
 *   clickref…clickref6 = sub-IDs visible in AWIN reports
 */

const CLICKREF_MAX = 50

export function slugTrack(value, max = CLICKREF_MAX) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
}

export function isTrackingBot(ua) {
  return /googlebot|bingbot|yandex|baiduspider|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|slackbot|ahrefs|semrush|dotbot|mj12bot|gptbot|claudebot|bytespider|petalbot|applebot|ia_archiver|screaming frog|lighthouse|pingdom|uptimerobot/i.test(
    String(ua || '')
  )
}

export function buildAwinClickRef({ productId, uuid, from } = {}) {
  const id = String(productId || '')
    .replace(/[^\w-]/g, '')
    .slice(-12)
  const src = slugTrack(from || 'web', 16)
  const parts = ['rx', id, src].filter(Boolean)
  return parts.join('-').slice(0, CLICKREF_MAX)
}

export function appendAwinClickRef(url, clickRef) {
  if (!url || !clickRef) return url
  try {
    const parsed = new URL(url)
    if (!/awin1\.com$/i.test(parsed.hostname)) return url
    parsed.searchParams.set('clickref', String(clickRef).slice(0, CLICKREF_MAX))
    return parsed.toString()
  } catch {
    return url
  }
}

/**
 * Attach publisher, merchant, clickrefs and UTM so AWIN can attribute
 * the exact vendor click and our campaign.
 */
export function prepareAwinExitUrl(
  url,
  {
    productId,
    uuid,
    from,
    vendor,
    vendorId,
    campaignId,
    affiliateId,
  } = {}
) {
  if (!url) return url
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return url
  }
  if (!/awin1\.com$/i.test(parsed.hostname)) return url

  const expectedA =
    affiliateId || process.env.AWIN_AFFILIATE_ID || ''
  const currentA =
    parsed.searchParams.get('a') || parsed.searchParams.get('awinaffid')
  if (expectedA && !currentA) {
    parsed.searchParams.set('a', String(expectedA))
  }

  if (vendorId && !parsed.searchParams.get('m')) {
    parsed.searchParams.set('m', String(vendorId))
  }

  const cid = String(campaignId || process.env.AWIN_CAMPAIGN_ID || '566')
  const clickref = buildAwinClickRef({ productId, uuid, from })
  parsed.searchParams.set('clickref', clickref)
  parsed.searchParams.set(
    'clickref2',
    slugTrack(vendor || parsed.searchParams.get('m') || 'vendor', 50)
  )
  if (vendorId || parsed.searchParams.get('m')) {
    parsed.searchParams.set(
      'clickref3',
      String(vendorId || parsed.searchParams.get('m')).slice(0, CLICKREF_MAX)
    )
  }
  parsed.searchParams.set('clickref4', `cid${cid}`.slice(0, CLICKREF_MAX))
  parsed.searchParams.set('clickref5', slugTrack(from || 'web', 50))

  parsed.searchParams.set('utm_source', 'reifexa')
  parsed.searchParams.set('utm_medium', 'affiliate')
  parsed.searchParams.set('utm_campaign', `reifen-${cid}`)
  parsed.searchParams.set(
    'utm_content',
    slugTrack(vendor || vendorId || 'shop', 80)
  )
  if (productId) {
    parsed.searchParams.set('utm_term', String(productId).slice(0, 80))
  }

  return parsed.toString()
}

export function extractAwinAffiliateId(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return (
      parsed.searchParams.get('a') ||
      parsed.searchParams.get('awinaffid') ||
      null
    )
  } catch {
    return null
  }
}

export function extractAwinMerchantId(url) {
  if (!url) return null
  try {
    return new URL(url).searchParams.get('m') || null
  } catch {
    return null
  }
}

export function logAwinTrackingMismatch(affiliateId) {
  const expected = process.env.AWIN_AFFILIATE_ID || process.env.AWIN_PUBLISHER_ID
  if (!expected || !affiliateId) return
  if (String(affiliateId) !== String(expected)) {
    console.warn(
      `[AWIN] Feed affiliate id (${affiliateId}) differs from AWIN_AFFILIATE_ID (${expected}). ` +
        'Verify campaign/API key in AWIN dashboard.'
    )
  }
}
