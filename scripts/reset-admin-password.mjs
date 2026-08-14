/**
 * Reset admin password in MongoDB.
 * Usage: node scripts/reset-admin-password.mjs <email> [newPassword]
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import Admin from '../src/models/Admin.js';

dotenv.config();

const email = process.argv[2];
const newPassword = process.argv[3] || 'Reifexa@2026';

if (!email) {
  console.error('Usage: node scripts/reset-admin-password.mjs <email> [newPassword]');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const admin = await Admin.findOne({ email: email.toLowerCase().trim() });
if (!admin) {
  console.error('Admin not found:', email);
  process.exit(1);
}

const hash = await bcrypt.hash(newPassword, 10);
await Admin.updateOne({ _id: admin._id }, { $set: { password: hash } });

console.log('✅ Password reset for:', admin.email);
console.log('   Name:', admin.firstName, admin.lastName);
console.log('   New password:', newPassword);
console.log('   Login: http://localhost:3001/');

await mongoose.disconnect();
