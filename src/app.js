// src/app.js
// import "./api/utils/cron-job.js";
import express from 'express';
import cors from 'cors';
import path from "path";
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/db.js';

// Route imports
import goRoutes from "./api/product/go.js";
import adminRoutes from './api/admin/admin.routes.js';
import authRoutes from './api/auth/auth.routes.js';
import productRoutes from './api/product/product.routes.js';
import vendorRoutes from './api/vendors/vendor.routes.js';
import faqRoutes from './api/faq/faq.routes.js';
import favoriteRoutes from './api/favorite/favorite.routes.js';
import wishlistRoutes from './api/wishlist/wishlist.route.js';
import blogRoutes from './api/blogs/blog.routes.js';
import outRoutes from "./api/utils/out.js";

dotenv.config();
connectDB();
const app = express();

// Middleware

// --- CORS CONFIG START --- //
const allowedOrigins = [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_DASHBOARD_URL || 'http://localhost:3001',
].filter(Boolean);
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            return callback(
                new Error(
                    `CORS: Origin ${origin} not allowed. Allowed origins: ${allowedOrigins.join(", ")}`
                )
            );
        }
    },
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
}));
// --- CORS CONFIG END --- //
app.use(cookieParser());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/visit', outRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/vendors', vendorRoutes);
app.use('/api/faq', faqRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/wishlist', wishlistRoutes)
app.use('/api/blogs', blogRoutes);
app.use('/images', express.static(path.join(process.cwd(), 'src', 'images')));



export default app;
