import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);
const col = mongoose.connection.db.collection('products');

const dupSample = await col.aggregate([
  { $match: { 'offers.1': { $exists: true } } },
  { $project: { ean: 1, product_name: 1, offers: 1 } },
  { $limit: 5000 },
]).toArray();

let dupProducts = 0;
for (const p of dupSample) {
  const names = (p.offers || []).map((o) => o.vendor);
  const ids = (p.offers || []).map((o) => String(o.vendor_id || ''));
  const nameSet = new Set(names);
  const idSet = new Set(ids.filter(Boolean));
  if (names.length !== nameSet.size || ids.filter(Boolean).length !== idSet.size) {
    dupProducts++;
    if (dupProducts <= 3) {
      console.log('\n--- Duplicate example ---');
      console.log(p.product_name?.slice(0, 60));
      (p.offers || []).forEach((o) =>
        console.log(`  ${o.vendor} | id=${o.vendor_id} | price=${o.price} | aw=${o.aw_product_id}`)
      );
    }
  }
}
console.log(`\nProducts with duplicate vendor names (in sample ${dupSample.length}): ${dupProducts}`);

const vendors = await col.aggregate([
  { $unwind: '$offers' },
  { $group: { _id: '$offers.vendor', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]).toArray();
console.log('\nAll vendors in offers:');
vendors.forEach((v) => console.log(`  ${v._id}: ${v.count}`));

const missingEu = await col.countDocuments({
  $or: [
    { fuel_class: { $in: [null, ''] } },
    { wet_grip: { $in: [null, ''] } },
    { noise_class: { $in: [null, ''] } },
  ],
});
const missingRating = await col.countDocuments({
  $or: [{ average_rating: { $exists: false } }, { average_rating: 0 }, { average_rating: null }],
});
const total = await col.countDocuments();
console.log(`\nTotal products: ${total}`);
console.log(`Missing EU label fields: ${missingEu}`);
console.log(`Missing/zero rating: ${missingRating}`);

await mongoose.disconnect();
