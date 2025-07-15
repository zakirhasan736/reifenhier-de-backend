import express from "express";
import multer from "multer";
import {
    getAllBrandsSummary,
    getProductsByBrand, deleteProductById, getAdminProductsPaginated } from './admin.controller.js';
import { runScraperManually } from "./scrapeController.js";
const router = express.Router();

router.get('/brand-lists', getAllBrandsSummary);
router.get('/brand-lists/:brand', getProductsByBrand);
router.delete('/product/:id', deleteProductById);
router.get('/product-lists', getAdminProductsPaginated);

// ##review scraper
router.post('/scrape-reviews', runScraperManually);

export default router;