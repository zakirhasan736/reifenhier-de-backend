// routes/analytics.routes.js
import express from "express";
import rateLimit from "express-rate-limit";
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
    logClick,
    logBehavior,
    getProductProof,
    getProductProofDetail,
} from "./analytics.controller.js";

const router = express.Router();

const beaconJson = express.json({ type: ["application/json", "text/plain"] });

/* sendBeacon uses text/plain */
router.post("/p", beaconJson, logClick);
router.post("/pv", beaconJson, logPageView);
/* Neutral behavior/events endpoint (adblock-safer than /track) */
router.post("/e", beaconJson, logBehavior);

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

const proofLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
});
router.post("/proof", proofLimiter, getProductProof);
router.get("/proof/:id", proofLimiter, getProductProofDetail);

export default router;