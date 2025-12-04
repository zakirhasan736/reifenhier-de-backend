// controllers/analytics.controller.js
import Click from "../../models/click.js";
import geoip from "geoip-lite";

/**
 * 📌 Track a click (product, vendor, brand, device, country, city, etc.)
 */
export const logClick = async (req, res) => {
    try {
        const {
            productId,
            productName,
            brandName,
            vendor,
            vendorId,
            uuid = "guest",
            source = "unknown"
        } = req.body;

        // -----------------------------
        // 🔥 1. Get REAL IP Address
        // -----------------------------
        const ip =
            req.headers["cf-connecting-ip"] ||      // Cloudflare real IP
            req.headers["x-real-ip"] ||             // NGINX real IP
            req.headers["x-forwarded-for"]?.split(",")[0] || // Proxy chain
            req.socket.remoteAddress ||
            "unknown";

        // -----------------------------
        // 🔥 2. Get Country
        // -----------------------------
        const country =
            req.headers["cf-ipcountry"] ||          // Cloudflare GEO
            req.headers["x-vercel-ip-country"] ||   // Vercel GEO
            req.headers["x-country"] ||
            "unknown";

        // -----------------------------
        // 🔥 3. Optional City Header
        // -----------------------------
        const city =
            req.headers["cf-ipcity"] ||
            req.headers["x-vercel-ip-city"] ||
            null;

        // -----------------------------
        // 🔥 4. Device Detection
        // -----------------------------
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

        // -----------------------------
        // 🔥 5. Save Click
        // -----------------------------
        await Click.create({
            product_id: productId || null,
            product_name: productName || "",
            brand_name: brandName || "",
            vendor: vendor || "",
            vendor_id: vendorId || "",
            uuid,
            source,
            ip,
            country,
            city,
            user_agent: ua,
            device_type,
            browser,
            os
        });

        return res.json({ success: true });
    } catch (err) {
        console.error("Click logging failed:", err);
        return res.status(500).json({ error: "failed_to_log_click" });
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
