import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./config/db.js";
import "./api/utils/cron-job.js";
import { startPriceAlertCron } from "./api/utils/priceAlertCron.js";
import { startPushCampaignCron } from "./api/utils/pushCampaignCron.js";
// import "./api/utils/cron-job-two.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function bootstrap() {
    try {
        console.log("[CRON] Starting standalone cron job...");
        await connectDB();
        console.log("[CRON] Connected to DB successfully.");
        startPriceAlertCron();
        startPushCampaignCron();
        console.log("[CRON] Cron jobs loaded. Waiting for schedule...");
        setInterval(() => { }, 1 << 30);
    } catch (err) {
        console.error("[CRON ERROR]", err);
        process.exit(1);
    }
}

bootstrap();
