import express from "express";
import rateLimit from "express-rate-limit";
import {
    subscribeNewsletter,
    unsubscribeNewsletter,
    getSubscribers,
    exportSubscribers,
    sendCampaign,
} from "./newsletter.controller.js";

const router = express.Router();

/**
 * 🧱 Rate limiter — protects from spam or bots
 * - Allows 5 requests per IP per minute
 * - Returns 429 error if exceeded
 */
const newsletterLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Zu viele Anfragen. Bitte versuchen Sie es in einer Minute erneut.",
    },
});

/**
 * ✉️ Input validator middleware
 */
const validateEmail = (req, res, next) => {
    const { email } = req.body;
    const valid = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (!valid) {
        return res
            .status(400)
            .json({ success: false, message: "Ungültige E-Mail-Adresse." });
    }
    next();
};

// -----------------------------------------------------------
// ✅ ROUTES
// -----------------------------------------------------------

// Subscribe to newsletter
router.post("/subscribe", newsletterLimiter, validateEmail, subscribeNewsletter);

// ✅ Secure Unsubscribe — no email validation required
router.post("/unsubscribe", newsletterLimiter, unsubscribeNewsletter);

router.get("/subscribers", getSubscribers);
router.get("/export", exportSubscribers);
router.post("/send-campaign", sendCampaign);
export default router;
