// src/scripts/scrapeController.js
import Product from "../../models/product.js";
import { getReifenRating } from "../utils/reviewScraper.js";

export const runScraperManually = async (req, res) => {
    try {
        const products = await Product.find({
            vendor: "Reifen.com",
            merchant_deep_link: { $exists: true, $ne: null },
        });

        let updated = 0;

        for (const p of products) {
            try {
                const { rating, reviewCount, gallery_images,  tyre_label_info } = await getReifenRating(p.merchant_deep_link);
                if (rating > 0 || reviewCount > 0) {
                    await Product.updateOne({ _id: p._id }, {
                        $set: {
                            average_rating: rating,
                            review_count: reviewCount,
                            gallery_images,
                            
                            tyre_label_info,
                        }
                    });
                    updated++;
                }
            } catch (err) {
                // Optionally log error for this product
            }
        }

        res.json({ message: "Scraping completed", updated });
    } catch (err) {
        res.status(500).json({ message: "Scraping failed", error: err.message });
    }
};
