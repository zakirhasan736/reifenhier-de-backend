// src/app.js
import "./api/utils/cron-job.js";
import express from 'express';
import cors from 'cors';
import path from "path";
import morgan from 'morgan';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
// import errorHandler from './middleware/errorHandler.js';

// Route imports
// import adminRoutes from './api/admin/admin.routes.js';
import authRoutes from './api/auth/auth.routes.js';
import productRoutes from './api/product/product.routes.js';
// import vendorRoutes from './api/vendors/vendor.routes.js';
// import tyreRoutes from './api/tyres/tyre.routes.js';
// import offerRoutes from './api/offers/offer.routes.js';
// import blogRoutes from './api/blogs/blog.routes.js';
// import campaignRoutes from './api/campaigns/campaign.routes.js';
// import analyticsRoutes from './api/analytics/analytics.routes.js';
// import cloakRoutes from './api/affiliate/cloak.routes.js';
// import searchRoutes from './api/search/search.routes.js';

dotenv.config();
connectDB();
const app = express();

// Middleware
app.use(cors()); 
app.use(express.json());
app.use(morgan('dev'));

// Routes
// app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
// app.use('/api/vendors', vendorRoutes);
// app.use('/api/tyres', tyreRoutes);
// app.use('/api/offers', offerRoutes);
// app.use('/api/blogs', blogRoutes);
// app.use('/api/campaigns', campaignRoutes);
// app.use('/api/analytics', analyticsRoutes);
// app.use('/api/cloak', cloakRoutes);
// app.use('/api/search', searchRoutes);
app.use('/images', express.static(path.join(process.cwd(), 'src', 'images')));

// Error handler
// app.use(errorHandler);

export default app;
