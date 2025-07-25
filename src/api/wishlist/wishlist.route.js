import express from 'express';
import {
    addWishlist,
    removeWishlist,
    getWishlist,
    getWishlistCount,
} from './wishlist.controller.js';

const router = express.Router();

router.post('/add', addWishlist);
router.post('/remove', removeWishlist);
router.get('/list', getWishlist);
router.get('/count', getWishlistCount);

export default router;