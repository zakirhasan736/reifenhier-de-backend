import express from "express";
import Product from "../../models/product.js";
import Click from "../../models/click.js";

const router = express.Router();

// GET /go/:clickId?product=PRODUCT_ID&uuid=UUID&from=SOURCE
router.get("/:clickId", async (req, res) => {
    const { clickId } = req.params;
    const { product: productId, uuid = "guest", from = "unknown" } = req.query;

    if (!productId || !clickId) return res.status(400).send("Invalid params");

    try {
        const product = await Product.findById(productId).lean();
        if (!product) return res.status(404).send("Product not found");

        const offer = product.offers?.find(o => o.aw_deep_link.includes(clickId));
        if (!offer) return res.status(404).send("Offer not found");

        await Click.create({
            product_id: productId,
            product_name: product.product_name,
            vendor: offer.vendor,
            vendor_id: offer.vendor_id,
            uuid,
            source: from,
            clicked_at: new Date()
        });

        return res.redirect(offer.original_affiliate_url);
    } catch (err) {
        console.error("[REDIRECT ERROR]", err);
        return res.status(500).send("Internal server error");
    }
});

export default router;