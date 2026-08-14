/**
 * Dedupe offers on existing products (no full AWIN re-import needed).
 * Usage: node scripts/repair-product-offers.mjs
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Product from '../src/models/product.js';
import { dedupeOffers, hasAwinAffiliateLink } from '../src/api/utils/offerUtils.js';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const LiveProduct = mongoose.model('Product', Product.schema, 'products');

const cursor = LiveProduct.find({}, { offers: 1, ean: 1, total_offers: 1 }).cursor();
let scanned = 0;
let repaired = 0;
let bulk = [];

for await (const doc of cursor) {
  scanned++;
  const offers = Array.isArray(doc.offers) ? doc.offers : [];
  const commissioned = offers.filter(
    (o) => hasAwinAffiliateLink(o) || /awin1\.com/i.test(o.original_affiliate_url || '')
  );
  const deduped = dedupeOffers(commissioned.length ? commissioned : offers);

  if (deduped.length !== offers.length) {
    bulk.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { offers: deduped, total_offers: deduped.length } },
      },
    });
    repaired++;
  }

  if (bulk.length >= 500) {
    await LiveProduct.bulkWrite(bulk);
    bulk = [];
    process.stdout.write(`\rRepaired ${repaired} / scanned ${scanned}`);
  }
}

if (bulk.length) await LiveProduct.bulkWrite(bulk);

console.log(`\n✅ Scanned ${scanned} products, repaired ${repaired} with duplicate/non-AWIN offers removed.`);
await mongoose.disconnect();
