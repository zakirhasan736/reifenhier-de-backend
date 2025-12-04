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
    logClick
} from "./analytics.controller.js";

const router = express.Router();

// Logging endpoint
router.post("/log-click", logClick);

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