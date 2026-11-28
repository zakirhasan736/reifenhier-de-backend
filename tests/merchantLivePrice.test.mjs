import test from "node:test";
import assert from "node:assert/strict";
import { keepMerchantPrice, keepMerchantPrices, isFreshMerchantPrice } from "../src/api/utils/merchantLivePrice.js";

const h = (n) => new Date(Date.now() - n * 3600e3);
const live = (o = {}) => ({ vendor_id: "1", aw_product_id: "A", price: 59.9, awin_price: 64.5, price_source: "merchant-live", merchant_price: 59.9, merchant_price_checked_at: h(1), ...o });

test("fresh shop-page price stays while the feed is unchanged", () => {
  assert.equal(keepMerchantPrice(live(), 64.5), true);
});
test("fresh shop-page price stays even when the feed number moved", () => {
  assert.equal(keepMerchantPrice(live(), 61.0), true);
});
test("page price older than 8 h → feed wins", () => {
  assert.equal(isFreshMerchantPrice(live({ merchant_price_checked_at: h(9) })), false);
  assert.equal(keepMerchantPrice(live({ merchant_price_checked_at: h(9) }), 64.5), false);
});
test("plain AWIN offers are never touched", () => {
  assert.equal(keepMerchantPrice({ price: 64.5, price_source: "awin" }, 64.5), false);
});
test("full import: a moved feed price is recorded, the page price stays", () => {
  const fromFeed = [{ vendor_id: "1", aw_product_id: "A", price: 61 }];
  assert.equal(keepMerchantPrices([live()], fromFeed), 1);
  assert.deepEqual([fromFeed[0].price, fromFeed[0].awin_price, fromFeed[0].price_source], [59.9, 61, "merchant-live"]);
});
test("full import: only the matching offer keeps its page price", () => {
  const existing = [live(), { vendor_id: "2", aw_product_id: "B", price: 70, price_source: "awin" }];
  const fromFeed = [
    { vendor_id: "1", aw_product_id: "A", price: 64.5 },
    { vendor_id: "2", aw_product_id: "B", price: 72 },
    { vendor_id: "3", aw_product_id: "C", price: 80 },
  ];
  assert.equal(keepMerchantPrices(existing, fromFeed), 1);
  assert.deepEqual([fromFeed[0].price, fromFeed[0].awin_price, fromFeed[0].price_source], [59.9, 64.5, "merchant-live"]);
  assert.equal(fromFeed[1].price, 72);
  assert.equal(fromFeed[2].price, 80);
});
test("other AWIN product id (shop changed the listing) → feed wins", () => {
  const fromFeed = [{ vendor_id: "1", aw_product_id: "Z", price: 64.5 }];
  assert.equal(keepMerchantPrices([live()], fromFeed), 0);
  assert.equal(fromFeed[0].price, 64.5);
});

import { applyShopPrice } from "../src/api/utils/merchantLivePrice.js";
test("shop page cheaper than feed → page price shown, feed price kept", () => {
  const o = { price: 64.5, price_source: "awin" };
  assert.equal(applyShopPrice(o, 59.9), true);
  assert.deepEqual([o.price, o.awin_price, o.price_source, o.price_mismatch], [59.9, 64.5, "merchant-live", false]);
});
test("next check: shop moved again → compares with the feed, not the old page price", () => {
  const o = { price: 59.9, awin_price: 64.5, price_source: "merchant-live" };
  assert.equal(applyShopPrice(o, 61.2), true);
  assert.deepEqual([o.price, o.awin_price], [61.2, 64.5]);
});
test("shop equals feed again → back to AWIN", () => {
  const o = { price: 59.9, awin_price: 64.5, price_source: "merchant-live" };
  applyShopPrice(o, 64.5);
  assert.deepEqual([o.price, o.price_source], [64.5, "awin"]);
});
test("implausible page price (> 25 %) is not shown, flagged", () => {
  const o = { price: 64.5, price_source: "awin" };
  assert.equal(applyShopPrice(o, 19.99), false);
  assert.deepEqual([o.price, o.price_mismatch, o.merchant_price], [64.5, true, 19.99]);
});
test("verify-only mode records but changes nothing", () => {
  const o = { price: 64.5, price_source: "awin" };
  assert.equal(applyShopPrice(o, 59.9, { apply: false }), false);
  assert.deepEqual([o.price, o.price_mismatch], [64.5, true]);
});
