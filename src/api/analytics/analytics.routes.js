// routes/analytics.routes.js
import express from "express";
import {
    getTopVendors,
    getTopProducts,
    getTopBrands,
    getDailyClicks,
    getWeeklyClicks,
    getMonthlyClicks,
    getDeviceAnalytics,
    getCountryAnalytics,
    logPageView,
    logClick
} from "./analytics.controller.js";

const router = express.Router();

/* sendBeacon uses text/plain */
router.post("/p", express.json({ type: ["application/json", "text/plain"] }), logClick);
/* sendBeacon compatibility */
router.post(
    "/pv",
    express.json({ type: ["application/json", "text/plain"] }),
    logPageView
);
// Rankings
router.get("/vendors", getTopVendors);
router.get("/products", getTopProducts);
router.get("/brands", getTopBrands);

// Charts
router.get("/daily", getDailyClicks);
router.get("/weekly", getWeeklyClicks);
router.get("/monthly", getMonthlyClicks);

// Device + GEO
router.get("/devices", getDeviceAnalytics);
router.get("/countries", getCountryAnalytics);

export default router;