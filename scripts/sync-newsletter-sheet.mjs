// Push every newsletter subscriber from MongoDB into the Google Sheet.
// Usage (from the backend folder): npm run newsletter:sheet
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import NewsletterSubscriber from "../src/models/NewsletterSubscriber.js";
import { replaceNewsletterSheet } from "../src/api/utils/googleSheetLeads.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

if (!process.env.MONGODB_URI) {
    console.error("MONGODB_URI is missing");
    process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const subscribers = await NewsletterSubscriber.find().sort({ createdAt: -1 }).lean();
const result = await replaceNewsletterSheet(subscribers);
console.log(`Google Sheet updated with ${result.count} newsletter leads`);
await mongoose.disconnect();
