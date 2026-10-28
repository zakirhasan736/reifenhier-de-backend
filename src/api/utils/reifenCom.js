/**
 * reifen.com is the default (priority) vendor of the site:
 *  - only tyres reifen.com sells as car tyres become products,
 *  - product info (name, images, description, labels) comes from reifen.com,
 *  - the reifen.com offer is always kept and listed first,
 *  - its price can be checked live on reifen.com (syncReifenComPrices.js).
 *
 * Every place that asks "is this reifen.com?" uses these helpers, so a
 * different spelling in the AWIN feed ("Reifen.com", "reifen.com DE",
 * "REIFEN.COM ") can't silently drop the vendor again.
 */

const MERCHANT_ID = String(process.env.REIFEN_COM_MERCHANT_ID || "").trim();

/** "reifen.com", "Reifen.com", "reifen.com DE" → true; "reifen DE", "reifendirekt" → false */
export function isReifenComName(name) {
  const n = String(name || "").toLowerCase().replace(/[\s._-]/g, "");
  return n.startsWith("reifencom");
}

export function isReifenComRow(row = {}) {
  if (MERCHANT_ID && String(row.merchant_id || "").trim() === MERCHANT_ID) return true;
  return isReifenComName(row.merchant_name);
}

export function isReifenComOffer(offer = {}) {
  if (MERCHANT_ID && String(offer.vendor_id || "").trim() === MERCHANT_ID) return true;
  return isReifenComName(offer.vendor);
}

/** Mongo filter for "the vendor field is reifen.com" (any spelling). */
export const REIFEN_COM_VENDOR_REGEX = /^\s*reifen[\s.]*com\b/i;

/** reifen.com first, everyone else after (stable). */
export function reifenComFirst(list = [], isReifen = isReifenComOffer) {
  return [...list].sort((a, b) => (isReifen(a) ? 0 : 1) - (isReifen(b) ? 0 : 1));
}

/**
 * Real reifen.com product URL for an offer: merchant_deep_link, or the
 * `ued=` target inside the AWIN tracking link.
 */
export function reifenComProductUrl(offer = {}) {
  const direct = String(offer.merchant_deep_link || "").trim();
  if (/^https?:\/\/(www\.)?reifen\.com\//i.test(direct)) return direct;
  if (direct.startsWith("/")) return `https://www.reifen.com${direct}`;
  const aw = String(offer.original_affiliate_url || "").trim();
  if (aw) {
    try {
      const ued = new URL(aw).searchParams.get("ued");
      if (ued && /^https?:\/\/(www\.)?reifen\.com\//i.test(ued)) return ued;
    } catch { /* not a URL */ }
  }
  return "";
}
