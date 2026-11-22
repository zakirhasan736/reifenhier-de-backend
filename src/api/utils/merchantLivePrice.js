/**
 * Prices read from the shop's own product page ("merchant-live").
 *
 * AWIN feeds often lag the shop by a day or more, so the price on reifexa did
 * not match the shop. refreshPricesFromMerchants.js now writes the shop-page
 * price onto the offer (price_source "merchant-live", the feed price kept in
 * awin_price). The AWIN jobs (full import every 3 h, quick price update) must
 * not put the older feed price back while that page price is fresh:
 *
 *   keep the page price  ⇔  checked within MERCHANT_LIVE_PRICE_TTL_HOURS
 *                           AND the feed still has the same price as when we
 *                           checked (the feed itself has not changed since).
 *
 * As soon as the feed gets a new price, or the page price gets old, the feed
 * price wins again until the next page check (every 5 h).
 */
export const MERCHANT_LIVE_TTL_MS = Number(process.env.MERCHANT_LIVE_PRICE_TTL_HOURS || 8) * 3600 * 1000;

const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

export function isFreshMerchantPrice(offer, now = Date.now()) {
    if (!offer || offer.price_source !== "merchant-live") return false;
    const at = offer.merchant_price_checked_at ? new Date(offer.merchant_price_checked_at).getTime() : 0;
    return !!at && now - at <= MERCHANT_LIVE_TTL_MS && Number(offer.price) > 0;
}

/** Should the stored page price stay, given the price the AWIN feed now has? */
export function keepMerchantPrice(oldOffer, feedPrice) {
    return isFreshMerchantPrice(oldOffer) && Number(oldOffer.awin_price) > 0 && near(oldOffer.awin_price, feedPrice);
}

const sameOffer = (a, b) =>
    String(a.vendor_id || "") === String(b.vendor_id || "") &&
    String(a.aw_product_id || "") === String(b.aw_product_id || "");

/**
 * Full import: copy fresh page prices from the stored offers onto the offers
 * just built from the feed. Returns how many offers kept their page price.
 */
export function keepMerchantPrices(existingOffers = [], newOffers = []) {
    let kept = 0;
    for (const neu of newOffers) {
        const old = existingOffers.find((o) => sameOffer(o, neu));
        if (!old || !keepMerchantPrice(old, neu.price)) continue;
        neu.awin_price = neu.price;
        neu.price = old.price;
        neu.price_source = "merchant-live";
        neu.merchant_price = old.merchant_price ?? old.price;
        neu.merchant_price_checked_at = old.merchant_price_checked_at;
        kept++;
    }
    return kept;
}

/**
 * refreshPricesFromMerchants: put the price read from the shop page onto the
 * offer (mutates it). Compares with the AWIN feed price (awin_price once a page
 * price is shown), never with an earlier page price. Returns true when the
 * shown price changed.
 *
 *   page ≠ feed, within maxApplyRatio  → show page price ("merchant-live")
 *   page = feed again                  → back to the feed price ("awin")
 *   page > maxApplyRatio off (bad read)→ feed price, flagged as mismatch
 */
export function applyShopPrice(offer, livePrice, { apply = true, mismatchRatio = 0.03, maxApplyRatio = 0.25 } = {}) {
    const wasLive = offer.price_source === "merchant-live" && Number(offer.awin_price) > 0;
    const feed = wasLive ? Number(offer.awin_price) : Number(offer.price) || 0;
    const before = Number(offer.price) || 0;
    const diffRatio = feed > 0 ? Math.abs(livePrice - feed) / feed : 1;
    offer.merchant_price = livePrice;
    offer.merchant_price_checked_at = new Date();
    offer.price_mismatch = diffRatio > mismatchRatio;

    if (apply && feed > 0 && diffRatio <= maxApplyRatio) {
        if (Math.abs(livePrice - feed) >= 0.01) {
            offer.awin_price = feed;
            offer.price = livePrice;
            offer.price_source = "merchant-live";
        } else if (wasLive) {
            offer.price = feed;
            offer.price_source = "awin";
        }
        offer.price_mismatch = false;
    } else if (wasLive) {
        offer.price = feed;
        offer.price_source = "awin";
    }
    return Math.abs((Number(offer.price) || 0) - before) >= 0.01;
}
