/**
 * Read the live price and stock of ONE tyre from a reifen.com product page.
 *
 * Only an unambiguous price of the main product is accepted (structured data
 * the shop publishes for Google). Cross-sells, shipping costs, "ab"-prices of
 * other sizes and sets of 4 are ignored. Anything unclear returns price
 * undefined, so the caller keeps the AWIN price instead of guessing.
 */
import axios from "axios";
import * as cheerio from "cheerio";
import { parsePrice } from "./offerPricing.js";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function availabilityToStock(value) {
  const v = String(value || "").toLowerCase();
  if (!v) return undefined;
  if (/outofstock|soldout|discontinued|nicht lieferbar|ausverkauft/.test(v)) return false;
  if (/instock|limitedavailability|preorder|backorder|onlineonly|lieferbar/.test(v)) return true;
  return undefined;
}

function collectJsonLdProducts($) {
  const products = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    let data;
    try {
      data = JSON.parse($(el).contents().text().trim());
    } catch {
      return;
    }
    const stack = [data];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== "object") continue;
      if (Array.isArray(n)) { stack.push(...n); continue; }
      if (n["@graph"]) stack.push(n["@graph"]);
      const types = [].concat(n["@type"] || []).map((t) => String(t).toLowerCase());
      if (types.includes("product")) products.push(n);
    }
  });
  return products;
}

/** @returns {{ price?: number, inStock?: boolean, source?: string, reason?: string }} */
export function parseReifenComPage(html) {
  if (!html || typeof html !== "string") return { reason: "empty page" };
  const $ = cheerio.load(html);

  // 1) JSON-LD: exactly one Product with one EUR offer price.
  const products = collectJsonLdProducts($);
  if (products.length === 1) {
    const prices = new Set();
    let inStock;
    for (const o of [].concat(products[0].offers || [])) {
      if (!o || typeof o !== "object") continue;
      if (String(o["@type"] || "").toLowerCase() === "aggregateoffer") continue;
      const cur = String(o.priceCurrency || o.priceSpecification?.priceCurrency || "EUR").toUpperCase();
      if (cur !== "EUR") continue;
      const p = parsePrice(o.price ?? o.priceSpecification?.price);
      if (p > 0) prices.add(p);
      const s = availabilityToStock(o.availability);
      if (s !== undefined) inStock = s;
    }
    if (prices.size === 1) return { price: [...prices][0], inStock, source: "json-ld" };
    if (prices.size > 1) return { reason: `json-ld has ${prices.size} different prices` };
  } else if (products.length > 1) {
    // Listing / comparison page, not a single tyre.
    return { reason: `page lists ${products.length} products` };
  }

  // 2) Microdata on the main product (itemprop="price").
  const scope = $('[itemtype*="schema.org/Product"]').first();
  const root = scope.length ? scope : $.root();
  const micro = new Set();
  root.find('[itemprop="price"]').each((_, el) => {
    // skip prices inside nested products (cross-sells)
    const owner = $(el).closest('[itemtype*="schema.org/Product"]');
    if (scope.length && owner.length && owner.get(0) !== scope.get(0)) return;
    const p = parsePrice($(el).attr("content") ?? $(el).text());
    if (p > 0) micro.add(p);
  });
  if (micro.size === 1) {
    const avail =
      root.find('[itemprop="availability"]').first().attr("href") ||
      root.find('[itemprop="availability"]').first().attr("content");
    return { price: [...micro][0], inStock: availabilityToStock(avail), source: "microdata" };
  }
  if (micro.size > 1) return { reason: `microdata has ${micro.size} different prices` };

  // 3) OpenGraph product price (one per page by definition).
  const og = new Set();
  $('meta[property="product:price:amount"], meta[property="og:price:amount"]').each((_, el) => {
    const p = parsePrice($(el).attr("content"));
    if (p > 0) og.add(p);
  });
  if (og.size === 1) {
    const avail = $('meta[property="product:availability"], meta[property="og:availability"]').attr("content");
    return { price: [...og][0], inStock: availabilityToStock(avail), source: "opengraph" };
  }

  return { reason: "no product price on page" };
}

/** Plain HTTP fetch. Returns { html, status, finalUrl }. */
export async function fetchReifenComHtml(url, timeoutMs = 20000) {
  try {
    const res = await axios.get(url, {
      timeout: timeoutMs,
      maxRedirects: 5,
      maxContentLength: 5 * 1024 * 1024,
      responseType: "text",
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9,en;q=0.5",
      },
      validateStatus: () => true,
    });
    return {
      html: typeof res.data === "string" ? res.data : "",
      status: res.status,
      finalUrl: res.request?.res?.responseUrl || url,
    };
  } catch (err) {
    return { html: "", status: err.code || "ERR", finalUrl: url };
  }
}

/** Real browser fallback (puppeteer) for pages that block plain HTTP. */
let browserPromise = null;
export async function fetchReifenComHtmlWithBrowser(url, timeoutMs = 45000) {
  const { default: puppeteer } = await import("puppeteer");
  browserPromise ||= puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
  const browser = await browserPromise;
  const page = await browser.newPage();
  try {
    await page.setUserAgent(UA);
    await page.setExtraHTTPHeaders({ "Accept-Language": "de-DE,de;q=0.9" });
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    return { html: await page.content(), status: resp?.status() ?? 0, finalUrl: page.url() };
  } catch (err) {
    return { html: "", status: err.name || "ERR", finalUrl: url };
  } finally {
    await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  await b?.close().catch(() => {});
}
