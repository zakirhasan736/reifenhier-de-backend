/**
 * Single source of truth for AWIN offer prices.
 *
 * Every job that touches offers (full import, quick price update, purge,
 * merchant verification) must use these helpers so the price shown on the
 * site, the "best price" vendor and the AWIN link always agree.
 */
import affiliateCloak from "./affiliateCloak.js";
import { isReifenComOffer, reifenComFirst } from "./reifenCom.js";

/**
 * Parse a price from an AWIN feed or a merchant page.
 * Handles "89.90", "89,90", "1.234,56", "1,234.56", "EUR 89.90", "89,90 €".
 * Returns a positive number or undefined.
 */
export function parsePrice(val) {
  if (val === null || val === undefined) return undefined;
  if (typeof val === "number") return Number.isFinite(val) && val > 0 ? +val.toFixed(2) : undefined;

  let s = String(val).trim().replace(/[^\d.,-]/g, "");
  if (!s || s.startsWith("-")) return undefined;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  if (lastDot >= 0 && lastComma >= 0) {
    // Last separator is the decimal one.
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // "1,234" (3 digits after a single comma, no other digits pattern) is ambiguous;
    // AWIN/EU shops use comma as decimal, so treat it as decimal.
    s = s.replace(/,/g, (m, i) => (i === lastComma ? "." : ""));
  } else if ((s.match(/\./g) || []).length > 1) {
    // "1.234.567" → thousands separators only
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? +n.toFixed(2) : undefined;
}

/** Price the shopper actually sees on the merchant page for this row. */
export function pickRowPrice(row = {}) {
  // search_price = AWIN's selling price; display_price/store_price are fallbacks.
  // base_price* is a unit price (per kg/l/piece) and must NOT be used.
  for (const key of ["search_price", "display_price", "store_price"]) {
    const p = parsePrice(row[key]);
    if (p) return p;
  }
  return 0;
}

/**
 * AWIN in_stock is "1"/"0", sometimes "true"/"false" or empty.
 * Empty / unknown counts as in stock (most feeds leave it blank).
 */
export function parseInStock(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0) return false;
  const s = String(val ?? "").trim().toLowerCase();
  if (!s) return true;
  if (["0", "0.0", "false", "no", "nein", "n", "out of stock", "outofstock", "nicht lieferbar", "ausverkauft"].includes(s)) {
    return false;
  }
  return true;
}

export function parseDeliveryCost(val) {
  if (val === null || val === undefined || String(val).trim() === "") return undefined;
  const s = String(val).toLowerCase();
  if (/kostenlos|gratis|free|frei/.test(s)) return 0;
  const n = parsePrice(val);
  return n === undefined ? (/^\s*0([.,]0+)?\s*$/.test(s) ? 0 : undefined) : n;
}

/** Offers a shopper can actually buy right now, best first. */
export function rankOffers(offers = []) {
  return [...offers]
    .filter((o) => Number(o?.price) > 0)
    .sort((a, b) => {
      const sa = a.in_stock === false ? 1 : 0;
      const sb = b.in_stock === false ? 1 : 0;
      if (sa !== sb) return sa - sb;
      const diff = Number(a.price) - Number(b.price);
      if (diff) return diff;
      // Same price: reifen.com (default vendor) wins the tie.
      return (isReifenComOffer(a) ? 0 : 1) - (isReifenComOffer(b) ? 0 : 1);
    });
}

/**
 * When at least one vendor has stock, hide vendors that explicitly report
 * no stock — otherwise "best price" sends people to a shop that can't sell.
 * The reifen.com offer is never hidden: it is the default vendor and the
 * product page always shows it (marked as not in stock when it isn't).
 */
export function dropOutOfStockWhenAlternatives(offers = []) {
  const inStock = offers.filter((o) => o.in_stock !== false || isReifenComOffer(o));
  return inStock.some((o) => o.in_stock !== false) ? inStock : offers;
}

function toDisplay(n) {
  return n > 0 ? `${n.toFixed(2).replace(".", ",")} €` : undefined;
}

function cheapestVendorFrom(offer) {
  if (!offer) return null;
  const url = offer.original_affiliate_url;
  return {
    aw_product_id: offer.aw_product_id,
    vendor_id: offer.vendor_id,
    vendor: offer.vendor,
    vendor_logo: offer.vendor_logo,
    price: offer.price,
    in_stock: offer.in_stock !== false,
    aw_deep_link: offer.aw_deep_link,
    payment_icons: offer.payment_icons,
    delivery_cost: offer.delivery_cost,
    original_affiliate_url: url,
    affiliate_product_cloak_url:
      offer.affiliate_product_cloak_url || (url ? affiliateCloak.encodeAffiliateUrl(url) : null),
  };
}

/**
 * Recompute per-offer savings and all product-level price fields.
 * Mutates offers' savings fields and returns the $set payload.
 */
export function computeOfferStats(offersIn = []) {
  // reifen.com (default vendor) is always listed first.
  const offers = reifenComFirst(offersIn);
  const priced = offers.filter((o) => Number(o?.price) > 0);
  const prices = priced.map((o) => Number(o.price));
  const max = prices.length ? Math.max(...prices) : 0;

  for (const o of offers) {
    const p = Number(o.price) || 0;
    const diff = p > 0 && max > p ? +(max - p).toFixed(2) : 0;
    o.savings_amount = diff;
    o.savings_percent = diff > 0 ? `-${Math.round((diff / max) * 100)}%` : "0%";
  }

  const best = rankOffers(offers)[0] || null;
  const reifenCom = offers.find(isReifenComOffer) || null;
  const cheapest = best ? Number(best.price) : 0;
  const expensive = max;
  const savings_amount = expensive > cheapest && cheapest > 0 ? +(expensive - cheapest).toFixed(2) : 0;
  const savings_percent = savings_amount > 0 ? `-${Math.round((savings_amount / expensive) * 100)}%` : "0%";

  return {
    offers,
    cheapest_offer: cheapest,
    expensive_offer: expensive,
    search_price: cheapest,
    savings_amount,
    savings_percent,
    cheapest_price_display: toDisplay(cheapest),
    expensive_price_display: toDisplay(expensive),
    savings_badge: savings_amount > 0 ? `Spare ${savings_percent}` : undefined,
    offer_count_display: offers.length > 1 ? `${offers.length} Angebote` : "1 Angebot",
    total_offers: offers.length,
    cheapest_vendor: cheapestVendorFrom(best),
    // Default vendor shown on every product, even when someone else is cheaper.
    default_vendor: cheapestVendorFrom(reifenCom),
    reifen_com_price: reifenCom && Number(reifenCom.price) > 0 ? Number(reifenCom.price) : undefined,
    payment_methods: best?.payment_icons || [],
    delivery_cost: best?.delivery_cost,
    ...(best?.aw_deep_link ? { product_url: best.aw_deep_link } : {}),
    in_stock: offers.some((o) => o.in_stock !== false && Number(o.price) > 0),
  };
}

/**
 * Product match key for a feed row. EAN first, then other GTIN-style
 * columns; digits only, leading zeros removed (EAN-13 vs UPC/GTIN-14
 * padding), so "04019238...", "4019238..." and "4019238...\t" all match.
 */
export function getFeedProductKey(row = {}) {
  for (const col of ["ean", "product_GTIN", "gtin", "upc", "isbn"]) {
    const raw = String(row[col] ?? "").trim();
    if (!raw || /e\+?\d/i.test(raw)) continue; // skip "4.01E+12" (Excel-mangled)
    const digits = raw.replace(/\D/g, "").replace(/^0+/, "");
    if (digits.length >= 8 && digits.length <= 14) return digits;
  }
  return "";
}
