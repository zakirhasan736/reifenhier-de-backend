import express from "express";
import affiliateCloak from "./affiliateCloak.js";
import fetch from "node-fetch";
import Product from "../../models/product.js";
import Click from "../../models/click.js";

const router = express.Router();

router.get("/out/:cloaked", async (req, res) => {
    const { cloaked } = req.params;
    const { product: productId, uuid = "guest", from = "unknown" } = req.query;

    const decodedUrl = affiliateCloak.decodeAffiliateUrl(cloaked);
    if (!decodedUrl) {
        return res.status(404).send("Invalid or expired link");
    }

    try {

        // Fetch affiliate page from server (not client)
        const response = await fetch(decodedUrl, {
            redirect: "follow",
            headers: {
                "User-Agent": req.headers["user-agent"] || "Mozilla/5.0"
            }
        });

        // If AWIN (or other network) redirects to merchant, grab final URL
        const finalUrl = response.url;

        // Redirect user to merchant (hiding the tracking network)
        return res.redirect(finalUrl);
    } catch (err) {
        console.error("Proxy redirect error:", err);
        return res.status(500).send("Failed to redirect. Try again later.");
    }
});

export default router;

