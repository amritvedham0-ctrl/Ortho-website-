import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, Product } from './models.js';

await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/amrit_vedham');
await User.updateOne({ email: process.env.ADMIN_EMAIL }, { $set: { name: 'Amrit Vedham Admin', email: process.env.ADMIN_EMAIL, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin' } }, { upsert: true });
if (!await Product.countDocuments()) await Product.insertMany([
  { name: 'King Kesari Chyawanprash', category: 'AYURVEDIC WELLNESS', tag: 'DAILY WELLNESS', description: 'A traditional chyawanprash-style formulation for your daily routine.', price: 499, weight: 'Pack size: Please confirm', image: '/assets/product1.jpeg' },
  { name: 'Ortho Amrit Capsule', category: 'AYURVEDIC CAPSULES', tag: 'JOINT CARE', description: 'A product for joint and muscle care; check the label for directions.', price: 399, weight: 'Pack size: 30 capsules', image: '/assets/product2.jpeg' },
  { name: 'King Kesari - Value Pack', category: 'KING KESARI', tag: 'SIGNATURE', description: 'Explore the King Kesari range for everyday wellness routines.', price: 599, weight: 'Pack size: Please confirm', image: '/assets/product1.jpeg' },
  { name: 'Ortho Amrit - Daily Care', category: 'ORTHO AMRIT', tag: 'ACTIVE CARE', description: 'View the product details and usage guidance before ordering.', price: 299, weight: 'Pack size: Please confirm', image: '/assets/product2.jpeg' }
]);
console.log('Seed complete'); await mongoose.disconnect();
