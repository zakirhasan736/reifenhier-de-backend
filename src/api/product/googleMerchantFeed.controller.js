import { once } from "node:events";
import Product from "../../models/product.js";

const SITE_URL = (
    process.env.GOOGLE_MERCHANT_SITE_URL ||
    "https://www.reifexa.de"
).replace(/\/$/, "");

const FEED_CURRENCY = process.env.GOOGLE_MERCHANT_CURRENCY || "EUR";

function cleanXmlText(value = "") {
    return String(value)
        .replace(/<[^>]*>/g, " ")
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function escapeXml(value = "") {
    return cleanXmlText(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function absoluteUrl(value, baseUrl = SITE_URL) {
    if (!value) return "";
    try {
        return new URL(String(value), `${baseUrl}/`).toString();
    } catch {
        return "";
    }
}

function productPrice(product) {
    const candidates = [
        product.search_price,
        product.cheapest_offer,
        product.main_price,
    ];
    return candidates
        .map(Number)
        .find((price) => Number.isFinite(price) && price > 0);
}

function productAvailability(product) {
    const offers = Array.isArray(product.offers) ? product.offers : [];
    if (offers.some((offer) => offer?.in_stock === true)) return "in_stock";
    if (offers.length && offers.every((offer) => offer?.in_stock === false)) {
        return "out_of_stock";
    }

    const value = String(product.in_stock ?? product.stock_status ?? "")
        .trim()
        .toLowerCase();
    return ["1", "true", "yes", "in_stock", "in stock", "available"].includes(value)
        ? "in_stock"
        : "out_of_stock";
}

function validGtin(value) {
    const gtin = String(value || "").replace(/\D/g, "");
    return [8, 12, 13, 14].includes(gtin.length) ? gtin : "";
}

function xmlField(name, value) {
    if (value === undefined || value === null || value === "") return "";
    return `    <${name}>${escapeXml(value)}</${name}>\n`;
}

export function buildGoogleMerchantItem(product, siteUrl = SITE_URL) {
    const id = String(product.ean || product._id || "").trim();
    const title = cleanXmlText(product.product_name).slice(0, 150);
    const description = cleanXmlText(
        product.description || product.product_short_description || title
    ).slice(0, 5000);
    const link = absoluteUrl(`/produkte/${encodeURIComponent(product.slug || "")}`, siteUrl);
    const imageLink = absoluteUrl(
        product.product_image || product.large_image || product.gallery_images?.[0],
        siteUrl
    );
    const price = productPrice(product);

    if (!id || !title || !product.slug || !link || !imageLink || !price) return "";

    const gtin = validGtin(product.gtin || product.product_GTIN || product.ean);
    const identifierExists = gtin || product.mpn || product.brand_name ? "yes" : "no";

    return [
        "  <item>\n",
        xmlField("g:id", id),
        xmlField("title", title),
        xmlField("description", description),
        xmlField("link", link),
        xmlField("g:image_link", imageLink),
        xmlField("g:availability", productAvailability(product)),
        xmlField("g:price", `${price.toFixed(2)} ${FEED_CURRENCY}`),
        xmlField("g:condition", "new"),
        xmlField("g:brand", product.brand_name),
        xmlField("g:gtin", gtin),
        xmlField("g:mpn", product.mpn),
        xmlField("g:identifier_exists", identifierExists),
        xmlField("g:product_type", product.product_type || "Autoreifen"),
        "  </item>\n",
    ].join("");
}

export async function googleMerchantFeed(req, res) {
    res.status(200);
    res.set({
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": 'inline; filename="google-merchant-feed.xml"',
        "Cache-Control": "public, max-age=300",
        "X-Content-Type-Options": "nosniff",
    });

    res.write('<?xml version="1.0" encoding="UTF-8"?>\n');
    res.write('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n');
    res.write("<channel>\n");
    res.write(xmlField("title", "Reifexa Produktfeed"));
    res.write(xmlField("link", SITE_URL));
    res.write(xmlField("description", "Aktuelle Reifenangebote von Reifexa"));

    let exported = 0;

    try {
        const cursor = Product.find({
            slug: { $exists: true, $nin: [null, ""] },
            search_price: { $gt: 0 },
            $or: [
                { product_image: { $exists: true, $nin: [null, ""] } },
                { large_image: { $exists: true, $nin: [null, ""] } },
                { "gallery_images.0": { $exists: true } },
            ],
        })
            .select({
                ean: 1,
                gtin: 1,
                product_GTIN: 1,
                mpn: 1,
                slug: 1,
                product_name: 1,
                description: 1,
                product_short_description: 1,
                brand_name: 1,
                product_type: 1,
                product_image: 1,
                large_image: 1,
                gallery_images: 1,
                search_price: 1,
                cheapest_offer: 1,
                main_price: 1,
                in_stock: 1,
                stock_status: 1,
                "offers.in_stock": 1,
            })
            .sort({ _id: 1 })
            .lean()
            .cursor({ batchSize: 250 });

        for await (const product of cursor) {
            if (res.writableEnded || res.destroyed) break;
            const item = buildGoogleMerchantItem(product);
            if (!item) continue;
            exported++;
            if (!res.write(item)) await once(res, "drain");
        }

        res.write("</channel>\n</rss>\n");
        res.end();
        console.log(`[GOOGLE-MERCHANT] Exported ${exported} products.`);
    } catch (error) {
        console.error("[GOOGLE-MERCHANT] Feed generation failed:", error);
        if (!res.headersSent) {
            res.status(500).json({ message: "Unable to generate product feed" });
        } else if (!res.writableEnded) {
            res.end("</channel>\n</rss>\n");
        }
    }
}
