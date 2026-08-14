/**
 * Append AWIN sub-tracking (clickref) before redirect.
 * Feed download uses cid/566; click URLs use affiliate id from aw_deep_link (a=… in pclick.php).
 */

export function buildAwinClickRef({ productId, uuid, from } = {}) {
  const parts = ['reifexa']
  if (productId) parts.push(String(productId).replace(/[^\w-]/g, '').slice(0, 48))
  if (from) parts.push(String(from).replace(/[^\w-]/g, '').slice(0, 24))
  if (uuid && uuid !== 'guest') parts.push(String(uuid).replace(/[^\w-]/g, '').slice(0, 24))
  return parts.join('-').slice(0, 200)
}

export function appendAwinClickRef(url, clickRef) {
  if (!url || !clickRef) return url
  try {
    const parsed = new URL(url)
    if (!/awin1\.com$/i.test(parsed.hostname)) return url
    parsed.searchParams.set('clickref', clickRef)
    return parsed.toString()
  } catch {
    return url
  }
}

/** Extract affiliate id from pclick.php (a=) or cread.php (awinaffid=) links. */
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
