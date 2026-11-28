import express from 'express';
import { requireAdmin } from '../../middleware/adminAuth.js';
import {
    overview,
    series,
    transactions,
    jobs,
    rerunImport,
    runFeedPrices,
    runShopPrices,
    subscribePush,
    unsubscribePush,
    testPush,
    pushStatus,
    homepageSession,
    updateHomepageSession,
    stream,
} from './ops.controller.js';

const router = express.Router();

router.use(requireAdmin);
router.get('/stream', stream);
router.get('/overview', overview);
router.get('/series', series);
router.get('/transactions', transactions);
router.get('/homepage', homepageSession);
router.put('/homepage', updateHomepageSession);
router.get('/jobs', jobs);
router.post('/jobs/import', rerunImport);
router.post('/jobs/feed-prices', runFeedPrices);
router.post('/jobs/shop-prices', runShopPrices);
router.get('/push/status', pushStatus);
router.post('/push/subscribe', subscribePush);
router.post('/push/unsubscribe', unsubscribePush);
router.post('/push/test', testPush);

export default router;
