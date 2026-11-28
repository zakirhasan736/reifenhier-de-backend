import express from 'express';
import { requireAdmin } from '../../middleware/adminAuth.js';
import {
    overview,
    transactions,
    jobs,
    rerunImport,
    runFeedPrices,
    runShopPrices,
    subscribePush,
    unsubscribePush,
    testPush,
} from './ops.controller.js';

const router = express.Router();

router.use(requireAdmin);
router.get('/overview', overview);
router.get('/transactions', transactions);
router.get('/jobs', jobs);
router.post('/jobs/import', rerunImport);
router.post('/jobs/feed-prices', runFeedPrices);
router.post('/jobs/shop-prices', runShopPrices);
router.post('/push/subscribe', subscribePush);
router.post('/push/unsubscribe', unsubscribePush);
router.post('/push/test', testPush);

export default router;
