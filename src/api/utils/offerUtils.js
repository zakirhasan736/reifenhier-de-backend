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

function parseRating(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseFloat(String(val).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function parseCount(val) {
  if (val === null || val === undefined || val === "") return 0;
  const n = parseInt(String(val).replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function pickReviewFields(rows = []) {
  for (const row of preferReifenComFirst(rows)) {
    const average_rating =
      parseRating(row.average_rating) || parseRating(row.rating);
    const review_count =
      parseCount(row.reviews) || parseCount(row.number_available);
    if (average_rating > 0 || review_count > 0) {
      return {
        average_rating,
        rating: average_rating,
        review_count,
        reviews: review_count,
      };
    }
  }
  return { average_rating: 0, rating: 0, review_count: 0, reviews: 0 };
}

const IMAGE_FIELDS = [
  "large_image",
  "merchant_image_url",
  "aw_image_url",
  "alternate_image",
  "alternate_image_two",
  "alternate_image_three",
  "alternate_image_four",
];

export function pickAwinImageUrl(masterRow = {}, feedImages = []) {
  const candidates = [
    masterRow.aw_image_url,
    masterRow.merchant_image_url,
    masterRow.large_image,
    ...(Array.isArray(feedImages) ? feedImages : []),
    masterRow.alternate_image,
    masterRow.aw_thumb_url,
    masterRow.merchant_thumb_url,
  ];
  for (const raw of candidates) {
    const v = String(raw || "").trim();
    if (/^https?:\/\//i.test(v)) return v;
  }
  return "";
}

export function isLocalProductImagePath(value) {
  return String(value || "").startsWith("/images/product-image/");
}

export function collectFeedImages(rows = [], masterRow = {}) {
  const urls = [];
  const seen = new Set();
  const add = (raw) => {
    const v = String(raw || "").trim();
    if (!v || !/^https?:\/\//i.test(v)) return;
    if (seen.has(v)) return;
    seen.add(v);
    urls.push(v);
  };

  const ordered = [masterRow, ...preferReifenComFirst(rows)].filter(Boolean);
  for (const row of ordered) {
    for (const field of IMAGE_FIELDS) add(row[field]);
  }
  add(masterRow.merchant_thumb_url);
  add(masterRow.aw_thumb_url);
  return urls;
}

export function pickOfferPrice(row = {}) {
  const candidates = [
    row.search_price,
    row.display_price,
    row.store_price,
    row.base_price_amount,
    row.base_price,
  ];
  for (const val of candidates) {
    if (val === null || val === undefined || val === "") continue;
    const n = parseFloat(String(val).replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
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
