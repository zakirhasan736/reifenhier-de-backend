/**
 * Giga Tyres EU (AWIN merchant 9352) publishes one feed per shop.
 * The feed currently joined is the Swiss shop: giga-reifen.ch, prices in CHF.
 * Reifexa is the German shop, so those rows must not be shown as euros,
 * and a click must open https://www.giga-reifen.de/ .
 */

export const GIGA_MERCHANT_ID = '9352'

export function isGigaVendor(row = {}) {
  const id = String(row.vendor_id || row.merchant_id || row.awin_merchant_id || '')
  if (id === GIGA_MERCHANT_ID) return true
  return /giga/i.test(String(row.vendor || row.merchant_name || ''))
}

/** Swiss-shop row: francs, or a giga-reifen.ch product URL. */
export function isSwissGigaOffer(row = {}) {
  if (!isGigaVendor(row)) return false
  const currency = String(row.currency || '').toUpperCase()
  const link = String(row.merchant_deep_link || '')
  return currency === 'CHF' || /(^|\.)giga-reifen\.ch\b/i.test(link)
}

/** Same product on the German shop, whether the stored link is .ch or already .de. */
export function germanGigaUrl(merchantUrl) {
  let parsed
  try {
    parsed = new URL(String(merchantUrl || ''))
  } catch {
    return ''
  }
  const host = parsed.hostname.toLowerCase()
  if (!/(^|\.)giga-reifen\.(ch|de)$/.test(host)) return ''
  parsed.protocol = 'https:'
  parsed.hostname = 'www.giga-reifen.de'
  if (parsed.searchParams.has('Country')) parsed.searchParams.set('Country', 'DE')
  return parsed.toString()
}

/** AWIN deep link that still attributes merchant 9352, but lands on .de. */
export function gigaGermanClickUrl(affiliateId, destination) {
  const url = new URL('https://www.awin1.com/cread.php')
  url.searchParams.set('awinmid', GIGA_MERCHANT_ID)
  url.searchParams.set('awinaffid', String(affiliateId || ''))
  url.searchParams.set('ued', destination)
  return url.toString()
}
