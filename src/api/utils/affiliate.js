import express from "express";
import affiliateCloak from "./affiliateCloak.js";
import fetch from "node-fetch";
import Product from "../../models/product.js";
import Click from "../../models/Click.js";

const router = express.Router();

router.get("/out/:cloaked", async (req, res) => {
    const { cloaked } = req.params;
    const { product: productId, uuid = "guest", from = "unknown" } = req.query;

    const decodedUrl = affiliateCloak.decodeAffiliateUrl(cloaked);
    if (!decodedUrl) {
        return res.status(404).send("Invalid or expired link");
    }

    try {
        // Log click if productId is provided
        if (productId) {
            const product = await Product.findById(productId).lean();
            if (product) {
                await Click.create({
                    product_id: product._id,
                    product_name: product.product_name,
                    vendor: product.vendor || product.cheapest_vendor?.vendor || "",
                    vendor_id: product.vendor_id || product.cheapest_vendor?.vendor_id || "",
                    uuid,
                    source: from
                });
            }
        }

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

