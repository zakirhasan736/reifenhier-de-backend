// controllers/analytics.controller.js
import mongoose from "mongoose";
import Click from "../../models/click.js";
import PageView from "../../models/pageView.js";
import Behavior from "../../models/behavior.js";
import AwinTransaction from "../../models/awinTransaction.js";
import geoip from "geoip-lite";

/* 🔐 IP anonymizer (GDPR) */
function anonymizeIp(ip) {
    if (!ip || ip === "unknown") return "unknown";
    if (ip.includes(".")) {
        return ip.split(".").slice(0, 3).join(".") + ".0";
    }
    return ip;
}

function isAtlasQuotaError(err) {
    return err?.code === 8000 || /space quota/i.test(String(err?.message || ""));
}

let quotaWarned = false;
function logAnalyticsWriteError(label, err) {
    if (isAtlasQuotaError(err)) {
        if (!quotaWarned) {
            quotaWarned = true;
            console.error(
                `[${label}] MongoDB Atlas storage quota exceeded — analytics writes skipped until space is freed`
            );
        }
        return;
    }
    console.error(label, err);
}
export const logPageView = async (req, res) => {
    try {
        const {
            uuid = "guest",
            page: pageBody,
            path,
            source = "unknown",
        } = req.body;

        const page = pageBody || path || "/";

        /* 1️⃣ IP */
        const rawIp =
            req.headers["cf-connecting-ip"] ||
            req.headers["x-real-ip"] ||
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress ||
            "unknown";

        const ip = anonymizeIp(rawIp);

        /* 2️⃣ GEO */
        let country =
            req.headers["cf-ipcountry"] ||
            req.headers["x-vercel-ip-country"];

        let city =
            req.headers["cf-ipcity"] ||
            req.headers["x-vercel-ip-city"];

        if (!country && rawIp !== "unknown") {
            const geo = geoip.lookup(rawIp);
            country = geo?.country || "unknown";
            city = geo?.city || null;
        }

        /* 3️⃣ DEVICE */
        const ua = req.headers["user-agent"] || "unknown";

        const device_type = /mobile/i.test(ua)
            ? "mobile"
            : /tablet/i.test(ua)
                ? "tablet"
                : "desktop";

        const browser = /chrome/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
                ? "Safari"
                : /firefox/i.test(ua)
                    ? "Firefox"
                    : /edge/i.test(ua)
                        ? "Edge"
                        : "Unknown";

        const os = /windows/i.test(ua)
            ? "Windows"
            : /mac os/i.test(ua)
                ? "macOS"
                : /android/i.test(ua)
                    ? "Android"
                    : /iphone|ipad/i.test(ua)
                        ? "iOS"
                        : "Unknown";

        /* 4️⃣ DEDUPLICATE (1 page view per user per page per 30 min) */
        const recentView = await PageView.findOne({
            uuid,
            page,
            viewed_at: { $gte: new Date(Date.now() - 30 * 60 * 1000) },
        });

        if (recentView) {
            return res.json({ success: true, deduped: true });
        }

        /* 5️⃣ SAVE */
        await PageView.create({
            uuid,
            page,
            source,
            ip,
            country,
            city,
            device_type,
            browser,
            os,
            user_agent: ua,
        });

        res.json({ success: true });
    } catch (err) {
        logAnalyticsWriteError("PageView failed:", err);
        if (isAtlasQuotaError(err)) {
            return res.json({ success: true, skipped: "quota" });
        }
        res.status(500).json({ error: "pageview_failed" });
    }
};

/* 📌 CLICK LOGGER */
export const logClick = async (req, res) => {
    try {
        const {
            productId,
            productName,
            brandName,
            vendor,
            vendorId,
            uuid = "guest",
            source = "unknown",
            instruction = "",
            behavior = "click",
        } = req.body;

        /* 1️⃣ REAL IP */
        const rawIp =
            req.headers["cf-connecting-ip"] ||
            req.headers["x-real-ip"] ||
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress ||
            "unknown";

        const ip = anonymizeIp(rawIp);

        /* 2️⃣ GEO (server-side only) */
        let country =
            req.headers["cf-ipcountry"] ||
            req.headers["x-vercel-ip-country"];

        let city =
            req.headers["cf-ipcity"] ||
            req.headers["x-vercel-ip-city"];

        if (!country && rawIp !== "unknown") {
            const geo = geoip.lookup(rawIp);
            country = geo?.country || "unknown";
            city = geo?.city || null;
        }

        /* 3️⃣ DEVICE */
        const ua = req.headers["user-agent"] || "unknown";

        const device_type = /mobile/i.test(ua)
            ? "mobile"
            : /tablet/i.test(ua)
                ? "tablet"
                : "desktop";

        const browser = /chrome/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
                ? "Safari"
                : /firefox/i.test(ua)
                    ? "Firefox"
                    : /edge/i.test(ua)
                        ? "Edge"
                        : "Unknown";

        const os = /windows/i.test(ua)
            ? "Windows"
            : /mac os/i.test(ua)
                ? "macOS"
                : /android/i.test(ua)
                    ? "Android"
                    : /iphone|ipad/i.test(ua)
                        ? "iOS"
                        : "Unknown";

        /* 4️⃣ DEDUPLICATION (3s window) */
        const recentClick = await Click.findOne({
            uuid,
            product_id: productId,
            vendor_id: vendorId,
            clicked_at: { $gte: new Date(Date.now() - 3000) },
        });

        if (recentClick) {
            return res.json({ success: true, deduped: true });
        }

        /* 5️⃣ SAVE */
        await Click.create({
            product_id: productId || null,
            product_name: productName || "",
            brand_name: brandName || "",
            vendor: vendor || "",
            vendor_id: vendorId || "",
            uuid,
            source,
            instruction: instruction || source,
            behavior,
            referrer: req.headers.referer || req.headers.referrer || "",
            ip,
            country,
            city,
            user_agent: ua,
            device_type,
            browser,
            os,
        });

        res.json({ success: true });
    } catch (err) {
        logAnalyticsWriteError("Click log failed:", err);
        if (isAtlasQuotaError(err)) {
            return res.json({ success: true, skipped: "quota" });
        }
        res.status(500).json({ error: "click_log_failed" });
    }
};

/* 📌 BEHAVIOR / INSTRUCTION LOGGER */
export const logBehavior = async (req, res) => {
    try {
        const {
            uuid = "guest",
            type = "other",
            page = "/",
            path,
            action = "",
            instruction = "",
            productId,
            vendor = "",
            vendorId = "",
            meta,
        } = req.body;

        const rawIp =
            req.headers["cf-connecting-ip"] ||
            req.headers["x-real-ip"] ||
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.socket.remoteAddress ||
            "unknown";

        const ip = anonymizeIp(rawIp);

        let country =
            req.headers["cf-ipcountry"] ||
            req.headers["x-vercel-ip-country"];
        let city =
            req.headers["cf-ipcity"] ||
            req.headers["x-vercel-ip-city"];

        if (!country && rawIp !== "unknown") {
            const geo = geoip.lookup(rawIp);
            country = geo?.country || "unknown";
            city = geo?.city || null;
        }

        const ua = req.headers["user-agent"] || "unknown";
        const device_type = /mobile/i.test(ua)
            ? "mobile"
            : /tablet/i.test(ua)
                ? "tablet"
                : "desktop";
        const browser = /chrome/i.test(ua)
            ? "Chrome"
            : /safari/i.test(ua)
                ? "Safari"
                : /firefox/i.test(ua)
                    ? "Firefox"
                    : /edge/i.test(ua)
                        ? "Edge"
                        : "Unknown";
        const os = /windows/i.test(ua)
            ? "Windows"
            : /mac os/i.test(ua)
                ? "macOS"
                : /android/i.test(ua)
                    ? "Android"
                    : /iphone|ipad/i.test(ua)
                        ? "iOS"
                        : "Unknown";

        await Behavior.create({
            uuid,
            type,
            page: page || path || "/",
            action,
            instruction,
            product_id: productId || null,
            vendor,
            vendor_id: vendorId,
            meta: meta || {},
            ip,
            country,
            city,
            user_agent: ua,
            device_type,
            browser,
            os,
        });

        res.json({ success: true });
    } catch (err) {
        logAnalyticsWriteError("Behavior log failed:", err);
        if (isAtlasQuotaError(err)) {
            return res.json({ success: true, skipped: "quota" });
        }
        res.status(500).json({ error: "behavior_log_failed" });
    }
};


/**
 * Helper to generate date ranges
 */
function getDateRange(days) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    return { start, end };
}

/**
 * 📌 Get clicks grouped by vendor
 */
export const getTopVendors = async (req, res) => {
    try {
        const data = await Click.aggregate([
            { $group: { _id: "$vendor", clicks: { $sum: 1 } } },
            { $sort: { clicks: -1 } },
            { $limit: 50 },
        ]);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Vendor analytics failed" });
    }
};

/**
 * 📌 Get clicks grouped by product
 */
export const getTopProducts = async (req, res) => {
    try {
        const data = await Click.aggregate([
            {
                $group: {
                    _id: "$product_id",
                    product_name: { $first: "$product_name" },
                    clicks: { $sum: 1 },
                },
            },
            { $sort: { clicks: -1 } },
            { $limit: 50 },
        ]);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Product analytics failed" });
    }
};

/**
 * 📌 Get clicks grouped by brand
 */
export const getTopBrands = async (req, res) => {
    try {
        const data = await Click.aggregate([
            { $group: { _id: "$brand_name", clicks: { $sum: 1 } } },
            { $sort: { clicks: -1 } },
            { $limit: 50 },
        ]);

        res.json(data);
    } catch (err) {
        res.status(500).json({ error: "Brand analytics failed" });
    }
};

/**
 * 📊 Line Chart — Daily Clicks (last 24 hours)
 */
export const getDailyClicks = async (req, res) => {
    try {
        const { start, end } = getDateRange(1);

        const data = await Click.aggregate([
            {
                $match: {
                    clicked_at: { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: { hour: { $hour: "$clicked_at" } },
                    clicks: { $sum: 1 },
                },
            },
            { $sort: { "_id.hour": 1 } },
        ]);

        res.json(data);
    } catch {
        res.status(500).json({ error: "Daily chart failed" });
    }
};

/**
 * 📊 Weekly Clicks (last 7 days)
 */
export const getWeeklyClicks = async (req, res) => {
    try {
        const { start, end } = getDateRange(7);

        const data = await Click.aggregate([
            { $match: { clicked_at: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { day: { $dayOfMonth: "$clicked_at" } },
                    clicks: { $sum: 1 },
                },
            },
            { $sort: { "_id.day": 1 } },
        ]);

        res.json(data);
    } catch {
        res.status(500).json({ error: "Weekly chart failed" });
    }
};

/**
 * 📊 Monthly Clicks (last 30 days)
 */
export const getMonthlyClicks = async (req, res) => {
    try {
        const { start, end } = getDateRange(30);

        const data = await Click.aggregate([
            { $match: { clicked_at: { $gte: start, $lte: end } } },
            {
                $group: {
                    _id: { day: { $dayOfMonth: "$clicked_at" } },
                    clicks: { $sum: 1 },
                },
            },
            { $sort: { "_id.day": 1 } },
        ]);

        res.json(data);
    } catch {
        res.status(500).json({ error: "Monthly chart failed" });
    }
};

/**
 * 📱 Device Analytics
 */
export const getDeviceAnalytics = async (req, res) => {
    try {
        const data = await Click.aggregate([
            { $group: { _id: "$device_type", count: { $sum: 1 } } },
        ]);

        res.json(data);
    } catch {
        res.status(500).json({ error: "Device analytics failed" });
    }
};

/**
 * 🌍 Country Analytics
 */
export const getCountryAnalytics = async (req, res) => {
    try {
        const data = await Click.aggregate([
            { $group: { _id: "$country", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
        ]);

        res.json(data);
    } catch {
        res.status(500).json({ error: "Country analytics failed" });
    }
};

function productPath(slug) {
    const clean = String(slug || "").trim().replace(/^\/+|\/+$/g, "");
    if (!clean || clean.includes("/") || clean.includes("..") || clean.length > 180) return "";
    return `/produkte/${clean}`;
}

function asObjectId(id) {
    const value = String(id || "").trim();
    return mongoose.Types.ObjectId.isValid(value) ? new mongoose.Types.ObjectId(value) : null;
}

function placeRows(rows) {
    return rows.map((row) => ({
        country: row._id?.country || "unknown",
        city: row._id?.city || "",
        count: row.count || 0,
    }));
}

/**
 * View and buyer counts for product cards. Views are product-page visits.
 * Buyers are distinct visitors who opened a shop (Zum Angebot). AWIN sales
 * are confirmed purchases and have no city, so they are returned separately.
 */
export const getProductProof = async (req, res) => {
    try {
        const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 48) : [];
        const ids = [];
        const paths = [];
        const byId = new Map();
        for (const item of items) {
            const oid = asObjectId(item?.id);
            const page = productPath(item?.slug);
            if (!oid || !page) continue;
            const id = String(oid);
            ids.push(oid);
            paths.push(page);
            byId.set(id, { id, page, tail: id.slice(-12), views: 0, buyers: 0, sales: 0 });
        }
        if (!ids.length) return res.json({ items: [] });

        const [viewRows, buyerRows, saleRows] = await Promise.all([
            PageView.aggregate([
                { $match: { page: { $in: paths } } },
                { $group: { _id: "$page", views: { $sum: 1 } } },
            ]),
            Click.aggregate([
                { $match: { product_id: { $in: ids }, behavior: "vendor_exit" } },
                { $group: { _id: { product: "$product_id", uuid: "$uuid" } } },
                { $group: { _id: "$_id.product", buyers: { $sum: 1 } } },
            ]),
            AwinTransaction.aggregate([
                {
                    $match: {
                        productId: { $in: [...byId.values()].map((row) => row.tail) },
                        status: { $nin: ["declined", "deleted"] },
                    },
                },
                { $group: { _id: "$productId", sales: { $sum: 1 } } },
            ]),
        ]);

        const viewsByPage = new Map(viewRows.map((row) => [row._id, row.views]));
        const buyersById = new Map(buyerRows.map((row) => [String(row._id), row.buyers]));
        const salesByTail = new Map(saleRows.map((row) => [row._id, row.sales]));
        const result = [...byId.values()].map((row) => ({
            id: row.id,
            views: viewsByPage.get(row.page) || 0,
            buyers: buyersById.get(row.id) || 0,
            sales: salesByTail.get(row.tail) || 0,
        }));
        res.json({ items: result });
    } catch (err) {
        logAnalyticsWriteError("Product proof failed:", err);
        res.status(500).json({ error: "product_proof_failed" });
    }
};

/** Country and city breakdown for one product. */
export const getProductProofDetail = async (req, res) => {
    try {
        const oid = asObjectId(req.params.id);
        const page = productPath(req.query.slug);
        if (!oid || !page) return res.status(400).json({ error: "invalid_product" });

        const [viewPlaces, buyerPlaces, sales] = await Promise.all([
            PageView.aggregate([
                { $match: { page } },
                { $group: { _id: { country: "$country", city: "$city" }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 12 },
            ]),
            Click.aggregate([
                { $match: { product_id: oid, behavior: "vendor_exit" } },
                { $group: { _id: { country: "$country", city: "$city", uuid: "$uuid" } } },
                { $group: { _id: { country: "$_id.country", city: "$_id.city" }, count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 12 },
            ]),
            AwinTransaction.countDocuments({
                productId: String(oid).slice(-12),
                status: { $nin: ["declined", "deleted"] },
            }),
        ]);

        res.json({
            viewPlaces: placeRows(viewPlaces),
            buyerPlaces: placeRows(buyerPlaces),
            sales,
        });
    } catch (err) {
        logAnalyticsWriteError("Product proof detail failed:", err);
        res.status(500).json({ error: "product_proof_failed" });
    }
};
