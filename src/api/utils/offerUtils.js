/**
 * Offer helpers for AWIN CSV import.
 */

export function normalizeVendorKey(offerOrRow) {
  const id = String(offerOrRow.vendor_id || offerOrRow.merchant_id || "").trim();
  if (id) return `id:${id}`;
  const name = String(offerOrRow.vendor || offerOrRow.merchant_name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return `name:${name}`;
}

/** Only offers with AWIN tracking URLs earn commission. */
export function hasAwinAffiliateLink(row) {
  const url = String(row?.aw_deep_link || row?.original_affiliate_url || "").trim();
  return /awin1\.com/i.test(url);
}

/**
 * Keep one offer per merchant — lowest price wins; prefer in-stock on tie.
 */
export function dedupeOffers(offers = []) {
  const byVendor = new Map();

  for (const offer of offers) {
    if (!offer?.vendor && !offer?.vendor_id) continue;
    const key = normalizeVendorKey(offer);
    const prev = byVendor.get(key);
    if (!prev) {
      byVendor.set(key, offer);
      continue;
    }

    const price = Number(offer.price) || 0;
    const prevPrice = Number(prev.price) || 0;
    const betterPrice = price > 0 && (prevPrice === 0 || price < prevPrice);
    const samePricePreferStock =
      price === prevPrice && offer.in_stock && !prev.in_stock;

    if (betterPrice || samePricePreferStock) {
      byVendor.set(key, offer);
    }
  }

  return Array.from(byVendor.values());
}

function preferReifenComFirst(rows = []) {
  return [...rows].sort((a, b) => {
    const score = (row) =>
      (row.merchant_name || "").trim().toLowerCase() === "reifen.com" ? 0 : 1;
    return score(a) - score(b);
  });
}

export function pickTyreLabelFields(rows = []) {
  for (const row of preferReifenComFirst(rows)) {
    const noise_class = String(row.custom_1 || row.noise_class || "").trim();
    const wet_grip = String(row.custom_2 || row.wet_grip || "").trim();
    const fuel_class = String(row.custom_3 || row.fuel_class || "").trim();
    if (noise_class || wet_grip || fuel_class) {
      return { noise_class, wet_grip, fuel_class };
    }
  }
  return { noise_class: "", wet_grip: "", fuel_class: "" };
}

export function pickReviewFields(rows = []) {
  for (const row of preferReifenComFirst(rows)) {
    const average_rating =
      parseFloat(row.average_rating) ||
      parseFloat(row.rating) ||
      0;
    const review_count =
      parseInt(row.reviews, 10) ||
      parseInt(row.number_available, 10) ||
      0;
    if (average_rating > 0 || review_count > 0) {
      return { average_rating, review_count, reviews: review_count };
    }
  }
  return { average_rating: 0, review_count: 0, reviews: 0 };
}

export function pickDescription(rows = [], fallback = "") {
  for (const row of preferReifenComFirst(rows)) {
    const desc = String(
      row.description || row.product_short_description || row.specifications || ""
    ).trim();
    if (desc.length > 20) return desc;
  }
  return fallback;
}
