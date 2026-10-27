import assert from "node:assert/strict";
import { test } from "node:test";
process.env.AWIN_CLOAK_SECRET ||= "0123456789abcdef0123456789abcdef";
const { parsePrice, pickRowPrice, parseInStock, computeOfferStats, dropOutOfStockWhenAlternatives } =
  await import("../src/api/utils/offerPricing.js");
const { dedupeOffers } = await import("../src/api/utils/offerUtils.js");
const { mainProductPrice } = await import("../src/api/utils/refreshPricesFromMerchants.js");

test("parsePrice handles AWIN and German formats", () => {
  assert.equal(parsePrice("89.90"), 89.9);
  assert.equal(parsePrice("89,90"), 89.9);
  assert.equal(parsePrice("1.234,56"), 1234.56);
  assert.equal(parsePrice("1,234.56"), 1234.56);
  assert.equal(parsePrice("EUR 102.49"), 102.49);
  assert.equal(parsePrice("102,49 €"), 102.49);
  assert.equal(parsePrice(""), undefined);
  assert.equal(parsePrice("0.00"), undefined);
});

test("row price never falls back to unit base_price", () => {
  assert.equal(pickRowPrice({ search_price: "", display_price: "EUR79.90", base_price: "19.97" }), 79.9);
  assert.equal(pickRowPrice({ base_price_amount: "19.97" }), 0);
});

test("in_stock parsing", () => {
  assert.equal(parseInStock("1"), true);
  assert.equal(parseInStock("0"), false);
  assert.equal(parseInStock(""), true);
  assert.equal(parseInStock("false"), false);
});

const url = (m, p) => `https://www.awin1.com/pclick.php?p=${p}&a=2985775&m=${m}`;
const offers = [
  { vendor: "ShopA", vendor_id: "1", price: 70, in_stock: false, original_affiliate_url: url(1, 11), aw_deep_link: "/go/11" },
  { vendor: "ShopA", vendor_id: "1", price: 82, in_stock: true, original_affiliate_url: url(1, 12), aw_deep_link: "/go/12" },
  { vendor: "ShopB", vendor_id: "2", price: 79.5, in_stock: true, original_affiliate_url: url(2, 21), aw_deep_link: "/go/21" },
  { vendor: "ShopC", vendor_id: "3", price: 65, in_stock: false, original_affiliate_url: url(3, 31), aw_deep_link: "/go/31" },
];

test("dedupe keeps in-stock row per vendor; out-of-stock vendors hidden when others deliver", () => {
  const d = dropOutOfStockWhenAlternatives(dedupeOffers(offers));
  assert.deepEqual(d.map(o => [o.vendor, o.price]), [["ShopA", 82], ["ShopB", 79.5]]);
  const s = computeOfferStats(d);
  assert.equal(s.cheapest_offer, 79.5);
  assert.equal(s.cheapest_vendor.vendor, "ShopB");
  assert.equal(s.cheapest_vendor.price, 79.5);
  assert.equal(s.cheapest_vendor.original_affiliate_url, url(2, 21));
  assert.ok(s.cheapest_vendor.affiliate_product_cloak_url);
  assert.equal(s.cheapest_price_display, "79,50 €");
  assert.equal(s.savings_amount, 2.5);
  assert.equal(s.product_url, "/go/21");
});

test("all out of stock: product kept, cheapest still shown, in_stock false", () => {
  const d = dropOutOfStockWhenAlternatives([offers[0], offers[3]]);
  const s = computeOfferStats(d);
  assert.equal(d.length, 2);
  assert.equal(s.cheapest_offer, 65);
  assert.equal(s.in_stock, false);
});

test("merchant page price: only the main product, never cross-sells/shipping", () => {
  const ld = o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
  const pdp = ld({ "@type": "Product", name: "Tyre", offers: { "@type": "Offer", price: "89.90", priceCurrency: "EUR" } })
    + ld({ "@type": "ItemList", itemListElement: [{ "@type": "Product", offers: { price: "12.00" } }] })
    + `<span>Versand 4,99 €</span><div data-price="9.99"></div>`;
  // cross-sell ItemList, shipping text and data-price are ignored
  assert.equal(mainProductPrice(pdp), 89.9);
  const two = ld({ "@type": "Product", offers: { price: "89.90" } }) + ld({ "@type": "Product", offers: { price: "59.90" } });
  assert.equal(mainProductPrice(two), undefined); // ambiguous page → don't guess
  const clean = ld({ "@graph": [{ "@type": "Product", offers: [{ "@type": "Offer", price: 89.9, priceCurrency: "EUR" }] }] })
    + `<span>Versand 4,99 €</span>`;
  assert.equal(mainProductPrice(clean), 89.9);
  assert.equal(mainProductPrice(`<meta property="product:price:amount" content="91,50">`), 91.5);
  assert.equal(mainProductPrice(`<p>ab 4,99 €</p>`), undefined);
});
