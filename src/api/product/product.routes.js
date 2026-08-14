import express from "express";
import multer from "multer";
import {
     productLists,
     productSitemapSlugs,
      // getProductsBySession,
      uploadCsv, getProductDetails, getBrandSummary, updateFeaturedSettings, getLatestProducts, getFeaturedProducts, GetFilterTyres, getSearchSuggestions } from "./product.controller.js";
import { getImportProgress } from "./importAWINCsv.js";
const upload = multer({ dest: "uploads/" });

const router = express.Router();

// Legacy/compatibility routes used by the frontend and older callers.
router.get("/", productLists);
router.get("/product-lists", productLists);
router.get("/sitemap-slugs", productSitemapSlugs);
router.get("/product-details/:slug", getProductDetails);

router.post("/upload-csv", upload.single("file"), uploadCsv);

// New: import progress
router.get("/upload-csv-progress", getImportProgress);
router.get("/import/status", getImportProgress);
// New: Products details data
// router.get("/product-details/:productId", getProductDetails);
router.get("/product-details/:slug", getProductDetails);

// New: Brand summary
router.get("/brand-summary", getBrandSummary);

// New: Latest products
router.get("/latest-products", getLatestProducts);

// New: Latest winter products
router.get("/sessions-products", getFeaturedProducts);
router.put('/sessions-settings', updateFeaturedSettings);

// Keep this last so it does not swallow concrete routes like /brand-summary, /latest-products, /sessions-products.
router.get("/:slug", getProductDetails);
// LIST ALL PRODUCTS BY CATEGORY (for admin selection)
// router.get("/products-by-session", getProductsBySession);

// New: Filter tyres
router.get("/filter-tyres", GetFilterTyres);

// New: Search suggestions
router.get("/suggestions", getSearchSuggestions);


export default router;
