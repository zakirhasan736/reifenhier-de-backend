// src/start-cron.mjs

import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import "./api/utils/cron-job.js";

// Load environment variables
dotenv.config();

// Resolve current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
    try {
        console.log("[CRON] Starting standalone cron job...");

        // Connect to DB
        await connectDB();

        console.log("[CRON] Connected to DB successfully.");
        console.log("[CRON] Cron job loaded. Waiting for schedule...");

        // Keep process alive (optional in PM2, but helpful when testing)
        setInterval(() => { }, 1 << 30);
    } catch (err) {
        console.error("[CRON ERROR]", err);
        process.exit(1);
    }
}

bootstrap();