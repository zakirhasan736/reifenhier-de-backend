// routes/faq.routes.js
import express from 'express';
import {
    getAllFAQs,
    createFAQ,
    updateFAQ,
    deleteFAQ,
} from './faq.controller.js';

const router = express.Router();

router.get('/faqs-lists', getAllFAQs);
router.post('/add-faq', createFAQ);
router.put('/:id', updateFAQ);
router.delete('/delete/:id', deleteFAQ);

export default router;
