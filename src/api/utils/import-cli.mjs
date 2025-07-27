// import-cli.mjs
import fs from "fs";
import path from "path";
import csv from "csv-parser";
import dotenv from "dotenv";
import mongoose from "mongoose";
import Product from "../../models/product.js";
import { importAWINCsv } from "../product/importAWINCsv.js"; // Adjust this to your actual file

// Load env vars
dotenv.config();

const LiveProduct = mongoose.model("Product", Product.schema, "products");

async function connectToDB() {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) throw new Error("Missing MONGO_URI in environment variables");

    await mongoose.connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
}

async function disconnectDB() {
    await mongoose.disconnect();
    console.log("✅ Disconnected from MongoDB");
}

async function main() {
    const args = process.argv.slice(2);
    const csvFilePath = args[0];

    if (!csvFilePath || !fs.existsSync(csvFilePath)) {
        console.error("❌ CSV file path is invalid or missing.");
        process.exit(1);
    }

    try {
        console.log(`📦 Starting import for file: ${csvFilePath}`);

        await connectToDB();

        // Run your import logic (should support streaming)
        await importAWINCsv(csvFilePath);

        console.log("✅ AWIN import completed successfully");
    } catch (err) {
        console.error("❌ Import failed:", err);
    } finally {
        await disconnectDB();
    }
}

main();
