import express from 'express';
import {
    addFavorite,
    removeFavorite,
    getFavorites,
    getFavoriteCount,
    getFavoriteStats
} from './favorite.controller.js';

const router = express.Router();

router.post('/add', addFavorite);
router.post('/remove', removeFavorite);
router.get('/list', getFavorites);
router.get('/count', getFavoriteCount);
router.get('/stats', getFavoriteStats);

export default router;
