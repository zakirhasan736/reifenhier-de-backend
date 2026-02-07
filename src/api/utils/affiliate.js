import express from "express";
import affiliateCloak from "./affiliateCloak.js";
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

    // 🔹 Log click (server-side, safe)
    try {
        if (productId) {
            const product = await Product.findById(productId).lean();
            if (product) {
                await Click.create({
                    product_id: product._id,
                    product_name: product.product_name,
                    vendor: product.vendor || product.cheapest_vendor?.vendor || "",
                    vendor_id: product.vendor_id || product.cheapest_vendor?.vendor_id || "",
                    uuid,
                    source: from,
                    clicked_at: new Date(),
                });
            }
        }
    } catch (err) {
        console.error("Click logging failed:", err);
    }

    // 🔐 Anti-cache + adblock-friendly headers
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Referrer-Policy", "no-referrer-when-downgrade");

    // ✅ CRITICAL: browser must hit AWIN
    return res.redirect(302, decodedUrl);
});

export default router;


