import express from 'express';
import { registerAdmin, loginAdmin } from './auth.controller.js';

const router = express.Router();

router.post('/admin/register', registerAdmin);
router.post('/admin/login', loginAdmin);

export default router;
