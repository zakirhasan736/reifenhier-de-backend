import express from 'express';
import {
    getAllVendorsSummary,
    deleteVendor, } from "./vendor.controller.js";

const router = express.Router();

router.get('/vendor-lists', getAllVendorsSummary);
router.delete('/vendor/:vendorName',  deleteVendor);

export default router;
