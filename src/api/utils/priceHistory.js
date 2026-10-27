/**
 * Price history helpers used by every job that changes prices.
 *
 *  - recordPriceSnapshots(products): upserts today's price per shop and the
 *    best price into PriceHistory (one bulkWrite).
 *  - nextPriceTrend(prevTrend, bestPrice): compact 90-day series kept on the
 *    product document, so product cards can draw a sparkline without an
 *    extra request.
 */
import PriceHistory from "../../models/PriceHistory.js";

export const BEST_KEY = "__best__";
const TREND_DAYS = 90;

export function berlinDay(d = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Berlin",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(d); // YYYY-MM-DD
}

const vendorKey = (o) => String(o.vendor_id || o.vendor || "").trim().toLowerCase();

function dayMinus(day, n) {
    const d = new Date(`${day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
}

/**
 * prevTrend.points: [[day, price], ...] ascending, max one point per day.
 * Adds/replaces today's point when the price changed and trims to 90 days.
 */
export function nextPriceTrend(prevTrend, bestPrice, day = berlinDay()) {
    const points = Array.isArray(prevTrend?.points) ? prevTrend.points.filter((p) => Array.isArray(p) && p.length === 2) : [];
    const price = Number(bestPrice);
    if (!(price > 0)) return { points, updated_at: day };
    const last = points[points.length - 1];
    if (last && last[0] === day) last[1] = price;
    else if (!last || Math.abs(Number(last[1]) - price) >= 0.01) points.push([day, +price.toFixed(2)]);
    const cutoff = dayMinus(day, TREND_DAYS);
    // keep the last point before the cutoff as the window's starting value
    let firstInWindow = points.findIndex((p) => p[0] >= cutoff);
    if (firstInWindow > 0) points.splice(0, firstInWindow - 1);
    return { points, updated_at: day };
}

/** products: [{ ean, offers:[{vendor, vendor_id, price, in_stock}], cheapest_offer }] */
export async function recordPriceSnapshots(products, day = berlinDay()) {
    const ops = [];
    const now = new Date();
    for (const p of products) {
        if (!p?.ean) continue;
        for (const o of p.offers || []) {
            const price = Number(o.price);
            if (!(price > 0)) continue;
            ops.push({
                updateOne: {
                    filter: { ean: String(p.ean), vendor_key: vendorKey(o), day },
                    update: { $set: { vendor: o.vendor, price, in_stock: o.in_stock !== false, at: now } },
                    upsert: true,
                },
            });
        }
        const best = Number(p.cheapest_offer);
        if (best > 0) {
            ops.push({
                updateOne: {
                    filter: { ean: String(p.ean), vendor_key: BEST_KEY, day },
                    update: { $set: { vendor: "Bester Preis", price: best, in_stock: true, at: now } },
                    upsert: true,
                },
            });
        }
    }
    if (!ops.length) return 0;
    try {
        await PriceHistory.bulkWrite(ops, { ordered: false });
    } catch (err) {
        // history must never break an import
        console.warn("[price-history] snapshot write failed:", err?.message || err);
    }
    return ops.length;
}

/** Series for the product page chart. */
export async function loadPriceHistory(ean, days = 90) {
    const today = berlinDay();
    const from = dayMinus(today, days);
    const rows = await PriceHistory.find({ ean: String(ean), day: { $gte: from } }, { _id: 0, vendor_key: 1, vendor: 1, day: 1, price: 1, in_stock: 1 })
        .sort({ day: 1 })
        .lean();
    // starting value for each line: last point before the window
    const before = await PriceHistory.aggregate([
        { $match: { ean: String(ean), day: { $lt: from } } },
        { $sort: { day: -1 } },
        { $group: { _id: "$vendor_key", vendor: { $first: "$vendor" }, price: { $first: "$price" }, in_stock: { $first: "$in_stock" } } },
    ]);
    const series = new Map();
    for (const b of before) series.set(b._id, { key: b._id, vendor: b.vendor, points: [[from, b.price]] });
    for (const r of rows) {
        if (!series.has(r.vendor_key)) series.set(r.vendor_key, { key: r.vendor_key, vendor: r.vendor, points: [] });
        const s = series.get(r.vendor_key);
        s.vendor = r.vendor || s.vendor;
        s.points.push([r.day, r.price]);
    }
    const best = series.get(BEST_KEY) || { key: BEST_KEY, vendor: "Bester Preis", points: [] };
    series.delete(BEST_KEY);
    return { from, to: today, best, vendors: [...series.values()] };
}
