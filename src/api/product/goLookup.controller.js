import Product from "../../models/product.js";

/**
 * GET /api/products/go-lookup/:awProductId → { slug }
 *
 * Offers store an internal label "/go/<aw_product_id>?from=reifendb". Google
 * found those paths in older page HTML and crawls www.reifexa.de/go/…, which
 * 404s. The frontend /go/[id] route uses this lookup to answer with a 301 to
 * the product page (or 410 when the product is gone).
 *
 * Read-only: no clicks are logged and no AWIN link is touched. Vendor clicks
 * keep going /to?t=… → /r/:token as before.
 */
export const goLookup = async (req, res) => {
    const awProductId = String(req.params.awProductId || "").trim();
    if (!/^\d{4,20}$/.test(awProductId)) {
        return res.status(400).json({ message: "Invalid id" });
    }
    try {
        const product = await Product.findOne(
            {
                $or: [
                    { "offers.aw_product_id": awProductId },
                    { aw_product_id: awProductId },
                ],
            },
            { slug: 1 }
        ).lean();
        res.setHeader("Cache-Control", "public, max-age=3600");
        if (!product?.slug) return res.status(404).json({ message: "Not found" });
        return res.status(200).json({ slug: product.slug });
    } catch (err) {
        console.error("Error in goLookup:", err);
        return res.status(500).json({ message: "Server error" });
    }
};
