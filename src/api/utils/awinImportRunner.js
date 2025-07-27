import mongoose from "mongoose";
import dotenv from "dotenv";
import { startCsvImportAsync, waitForImportToFinish } from "../product/importAWINCsv.js";
import ImportMeta from "../../models/ImportMeta.js";

dotenv.config();

const csvPath = process.argv[2]; // passed by parent
if (!csvPath) {
    console.error("❌ CSV path not provided");
    process.exit(1);
}

(async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("✅ Connected to MongoDB");

        startCsvImportAsync(csvPath);
        await waitForImportToFinish();

        await ImportMeta.findOneAndUpdate(
            { source: "AWIN" },
            { $set: { lastSuccess: new Date() } },
            { upsert: true }
        );

        console.log("✅ AWIN Import finished successfully.");
        process.exit(0);
    } catch (err) {
        console.error("❌ Import failed:", err);
        process.exit(1);
    }
})();
