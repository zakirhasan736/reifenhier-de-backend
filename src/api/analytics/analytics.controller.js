// controllers/analytics.controller.js
import Click from "../../models/click.js";
import PageView from "../../models/pageView.js";
import Behavior from "../../models/behavior.js";
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
