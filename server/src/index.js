import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import Razorpay from 'razorpay';
import ImageKit from 'imagekit';
import multer from 'multer';
import mongoose from 'mongoose';
import { User, Product, Order } from './models.js';
import { credentialsSchema, productSchema, checkoutSchema } from './validation.js';
import { issueToken, publicUser, requireAuth, requireAdmin } from './auth.js';

const app = express();
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, callback) => callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
});
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: (origin, callback) => !origin || allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error('Origin is not allowed')) }));
app.use(express.json({ limit: '100kb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 80 }));
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const parse = (schema, value) => schema.safeParse(value);
const razorpay = process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET }) : null;
const imageKit = process.env.IMAGEKIT_PUBLIC_KEY && process.env.IMAGEKIT_PRIVATE_KEY && process.env.IMAGEKIT_URL_ENDPOINT ? new ImageKit({ publicKey: process.env.IMAGEKIT_PUBLIC_KEY, privateKey: process.env.IMAGEKIT_PRIVATE_KEY, urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT }) : null;

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const parsed = parse(credentialsSchema.required({ name: true }), req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Please enter a valid name, email and password' });
  const exists = await User.findOne({ email: parsed.data.email });
  if (exists) return res.status(409).json({ message: 'An account with that email already exists' });
  const user = await User.create({ ...parsed.data, passwordHash: await bcrypt.hash(parsed.data.password, 12) });
  res.status(201).json({ token: issueToken(user), user: publicUser(user) });
}));
app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const parsed = parse(credentialsSchema.omit({ name: true }), req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Please enter a valid email and password' });
  const user = await User.findOne({ email: parsed.data.email });
  if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) return res.status(401).json({ message: 'Invalid email or password' });
  res.json({ token: issueToken(user), user: publicUser(user) });
}));
app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

app.get('/api/products', asyncRoute(async (req, res) => res.json(await Product.find({ active: true }).sort({ createdAt: 1 }))));
app.get('/api/products/:id', asyncRoute(async (req, res) => { const product = await Product.findOne({ _id: req.params.id, active: true }); if (!product) return res.status(404).json({ message: 'Product not found' }); res.json(product); }));
app.post('/api/admin/products', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const parsed = parse(productSchema, req.body); console.log(parsed.error); if (!parsed.success) return res.status(400).json({ message: 'Product data is invalid' }); res.status(201).json(await Product.create(parsed.data)); }));
app.put('/api/admin/products/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const parsed = parse(productSchema.partial(), req.body); if (!parsed.success) return res.status(400).json({ message: 'Product data is invalid' }); const product = await Product.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true }); if (!product) return res.status(404).json({ message: 'Product not found' }); res.json(product); }));
app.delete('/api/admin/products/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { await Product.findByIdAndUpdate(req.params.id, { active: false }); res.status(204).end(); }));
app.post('/api/admin/uploads', requireAuth, requireAdmin, imageUpload.single('image'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Upload a JPEG, PNG, or WebP image up to 5 MB' });
  if (!imageKit) return res.status(503).json({ message: 'Image upload is not configured' });
  const uploaded = await imageKit.upload({ file: req.file.buffer, fileName: `${crypto.randomUUID()}-${req.file.originalname}` });
  res.status(201).json({ image: uploaded.url });
}));

app.post('/api/orders', requireAuth, asyncRoute(async (req, res) => {
  const parsed = parse(checkoutSchema, req.body); if (!parsed.success) return res.status(400).json({ message: 'Please complete all checkout fields' });
  const products = await Product.find({ _id: { $in: parsed.data.items.map((item) => item.productId) }, active: true });
  const productMap = new Map(products.map((product) => [product._id.toString(), product]));
  const items = parsed.data.items.map((item) => { const product = productMap.get(item.productId); if (!product) throw Object.assign(new Error('A product in your cart is unavailable'), { status: 400 }); return { product: product._id, name: product.name, price: product.price, quantity: item.quantity }; });
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = await Order.create({ user: req.user._id, items, customer: parsed.data.customer, address: parsed.data.address, total });
  if (razorpay) { const paymentOrder = await razorpay.orders.create({ amount: total * 100, currency: 'INR', receipt: order._id.toString() }); order.razorpayOrderId = paymentOrder.id; await order.save(); return res.status(201).json({ order, payment: { id: paymentOrder.id, amount: paymentOrder.amount, currency: paymentOrder.currency, key: process.env.RAZORPAY_KEY_ID } }); }
  res.status(201).json({ order, payment: null, message: 'Payment gateway is not configured yet' });
}));
app.post('/api/orders/:id/verify-payment', requireAuth, asyncRoute(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }); if (!order) return res.status(404).json({ message: 'Order not found' });
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest('hex');
  if (expected !== razorpay_signature || order.razorpayOrderId !== razorpay_order_id) return res.status(400).json({ message: 'Payment verification failed' });
  order.paymentStatus = 'paid'; order.razorpayPaymentId = razorpay_payment_id; await order.save(); res.json({ order });
}));
app.get('/api/orders', requireAuth, asyncRoute(async (req, res) => res.json(await Order.find({ user: req.user._id }).sort({ createdAt: -1 }))));
app.get('/api/admin/orders', requireAuth, requireAdmin, asyncRoute(async (req, res) => res.json(await Order.find().populate('user', 'name email').sort({ createdAt: -1 }))));
app.patch('/api/admin/orders/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => { const status = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'].includes(req.body.status) ? req.body.status : null; if (!status) return res.status(400).json({ message: 'Invalid order status' }); const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true }); if (!order) return res.status(404).json({ message: 'Order not found' }); res.json(order); }));

app.use((err, req, res, next) => { console.error(err); if (err instanceof multer.MulterError) return res.status(400).json({ message: err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : 'Image upload failed' }); res.status(err.status || 500).json({ message: err.status ? err.message : 'Something went wrong on the server' }); });
const port = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/amrit_vedham').then(() => app.listen(port, () => console.log(`API listening on ${port}`))).catch((error) => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
export default app;
