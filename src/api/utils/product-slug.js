import mongoose from 'mongoose';
import dotenv from 'dotenv';
import slugify from 'slugify';
import Product from '../../models/product.js';

dotenv.config();

const BATCH_SIZE = 100;

async function updateSlugsInBatches() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const total = await Product.countDocuments({ slug: { $exists: false } });
    console.log(`Total products without slugs: ${total}`);

    let processed = 0;

    for (let skip = 0; skip < total; skip += BATCH_SIZE) {
        const products = await Product.find({ slug: { $exists: false } })
            .skip(skip)
            .limit(BATCH_SIZE);

        for (const product of products) {
            try {
                const noDim = product.product_name.replace(/\b\d{3}\/\d{2}\s?R\d{2}\b/g, '').trim();
                const slug = slugify(`${product.brand_name} ${noDim}`, { lower: true });

                product.slug = slug;
                await product.save();

                processed++;
                console.log(`[${processed}/${total}] Updated slug for product: ${product._id}`);
            } catch (err) {
                console.error(`Error updating product ${product._id}:`, err.message);
            }
        }
    }

    console.log(`Slug creation complete. Total updated: ${processed}`);
    mongoose.disconnect();
    process.exit(0);
}

updateSlugsInBatches();
