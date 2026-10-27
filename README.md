# Amrit Vedham Shop

A MERN e-commerce implementation using the supplied Amrit Vedham HTML as the visual template. The React client preserves the original classes, palette, typography, product grid, trust strip, and responsive breakpoints while the Express API provides real persistence and authorization.

## Requirements

- Node.js 20+
- MongoDB 6+ locally or a MongoDB Atlas connection
- Razorpay account for live checkout payments

## Setup

1. Copy `.env.example` to `.env` and set `MONGODB_URI`, `JWT_SECRET`, and `CLIENT_URL`. Add Razorpay credentials before enabling payments.
2. Install dependencies: `npm install && npm install --prefix server && npm install --prefix client`.
3. Seed the admin account and starter products: `node server/src/seed.js`.
4. Start both applications: `npm run dev`.
5. Open `http://localhost:5173`.

The API runs on port 5000 and the Vite client proxies `/api` requests to it. The admin account is created from `ADMIN_EMAIL` and `ADMIN_PASSWORD`; change both before seeding.

## Features

Customer accounts use bcrypt password hashing and JWT authorization. Product data, carts, orders, payment state, and order history are persisted in MongoDB. Checkout creates a server-side Razorpay order, and the server verifies the Razorpay signature before marking an order paid. Admin routes require a JWT with the `admin` role and support product CRUD plus order status updates.

Admin product images can be uploaded directly from the product form. The API accepts JPEG, PNG, and WebP files up to 5 MB, stores them under `server/uploads`, and returns the hosted image URL for the product record. Existing product images are retained when editing unless a replacement file is selected.

Without Razorpay credentials, order creation still validates and persists the order but returns a configuration message instead of opening a payment window. This is intended for local API development only; configure Razorpay before accepting payments.
