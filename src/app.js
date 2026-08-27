// src/app.js
// Load env before any other local imports that may read process.env
import './loadEnv.js'
// import "./api/utils/cron-job.js";
import express from 'express';
import cors from 'cors';
import path from "path";
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { isMongoReady } from './config/db.js';

// Route imports
import adminRoutes from './api/admin/admin.routes.js';
import authRoutes from './api/auth/auth.routes.js';
import productRoutes from './api/product/product.routes.js';
import vendorRoutes from './api/vendors/vendor.routes.js';
import faqRoutes from './api/faq/faq.routes.js';
import favoriteRoutes from './api/favorite/favorite.routes.js';
import wishlistRoutes from './api/wishlist/wishlist.route.js';
import blogRoutes from './api/blogs/blog.routes.js';
import affiliateRouter from './api/utils/affiliate.js'; 
import newsletterRoutes from './api/newsletter/newsletter.route.js';
import analyticsRoutes from './api/analytics/analytics.routes.js';
import pushRoutes from './api/push/push.routes.js';

const app = express();

app.get('/health', (_req, res) => {
    res.json({
        ok: true,
        mongo: isMongoReady(),
        uptime: process.uptime(),
    })
})
app.get('/api/health', (_req, res) => {
    res.json({
        ok: true,
        mongo: isMongoReady(),
        uptime: process.uptime(),
    })
})

// Middleware

// --- CORS CONFIG START --- //
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001',
    'https://www.reifexa.de',
    'https://reifexa.de',
    'https://admin.reifexa.de',
    'https://wp.reifencheck.de',
].filter(Boolean);

// Deduplicate while preserving order
const uniqueOrigins = [...new Set(allowedOrigins)];

app.use(cors({
    origin: function (origin, callback) {
        if (process.env.NODE_ENV !== 'production') {
            console.log('🌐 Incoming Origin:', origin);
        }

        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (uniqueOrigins.includes(origin)) {
            return callback(null, true);
        }
        console.warn(`CORS blocked origin: ${origin}`)
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
}));
console.log('✅ Allowed CORS Origins:', uniqueOrigins);

// --- CORS CONFIG END --- //
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/', affiliateRouter);
app.use('/api/v1', analyticsRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/blogs', blogRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/images', express.static(path.join(process.cwd(), 'src', 'images')));



export default app;
