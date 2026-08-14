import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import mongoose from 'mongoose'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../.env') })
await mongoose.connect(process.env.MONGODB_URI)
const p = await mongoose.connection.db.collection('products').findOne(
  { 'offers.vendor': 'reifen DE' },
  { projection: { product_name: 1, cheapest_vendor: 1, offers: 1 } }
)
if (!p) {
  console.log('no product')
} else {
  console.log(p.product_name)
  console.log('cheapest', p.cheapest_vendor?.vendor, p.cheapest_vendor?.vendor_logo, (p.cheapest_vendor?.payment_icons||[]).length)
  for (const o of p.offers || []) {
    console.log('-', o.vendor, '| logo=', o.vendor_logo, '| payments=', (o.payment_icons||[]).length)
  }
}
await mongoose.disconnect()
