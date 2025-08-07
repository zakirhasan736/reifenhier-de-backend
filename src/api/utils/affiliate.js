import express from "express";
import affiliateCloak from "./affiliateCloak.js";
import fetch from "node-fetch";

const router = express.Router();

router.get("/out/:cloaked", async (req, res) => {
    const encoded = req.params.cloaked;
    const decodedUrl = affiliateCloak.decodeAffiliateUrl(encoded);

    if (!decodedUrl) {
        return res.status(404).send("Invalid or expired link");
    }

    try {
        // Request the affiliate page from your server (not from the browser)
        const response = await fetch(decodedUrl, {
            redirect: "follow",
            headers: {
                "User-Agent": req.headers["user-agent"] || "Mozilla/5.0"
            }
        });

        // If AWIN redirects to the merchant site, get the final URL
        const finalUrl = response.url;

        // Now redirect the user to the merchant (no awin.com in sight)
        return res.redirect(finalUrl);
    } catch (err) {
        console.error("Proxy redirect error:", err);
        return res.status(500).send("Failed to redirect. Try again later.");
    }
});

export default router;
