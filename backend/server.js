/**
 * server.js — Entry point for the Smart Expense Tracker API
 *
 * MERN Data Flow:
 *   React (Frontend) → Axios HTTP Request → Express Router → Controller → Mongoose → MongoDB
 *   MongoDB Response → Mongoose Model → Controller → Express JSON Response → React State
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// ─── Import Route Modules ────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');

// ─── Initialise Express App ──────────────────────────────────────────────────
const app = express();

// ─── Core Middleware ─────────────────────────────────────────────────────────

// Parse incoming JSON payloads (replaces body-parser in Express 4.16+)
app.use(express.json());

// Parse URL-encoded form data
app.use(express.urlencoded({ extended: true }));

// Enable Cross-Origin Resource Sharing so the React Vite dev server
// (typically port 5173) can communicate with this API (typically port 5000)
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);

// HTTP request logger — prints method, URL, status, and response time
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ─── Database Connection ─────────────────────────────────────────────────────

/**
 * connectDB — Establishes a Mongoose connection to MongoDB Atlas (or local).
 * We keep this async so the server only starts AFTER a successful connection.
 */
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      // These options suppress deprecation warnings in Mongoose 7+
      // (they are now defaults, but kept here for explicit clarity)
    });
    console.log(`✅  MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection error: ${error.message}`);
    // Exit with failure code — no point running the API without a database
    process.exit(1);
  }
};

// ─── API Routes ───────────────────────────────────────────────────────────────

// Health-check endpoint — useful for deployment platforms (Railway, Render, etc.)
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Smart Expense Tracker API is running 🚀',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// Mount authentication routes → /api/auth/register, /api/auth/login, /api/auth/me
app.use('/api/auth', authRoutes);

// Mount transaction routes → /api/transactions  (protected by JWT middleware)
app.use('/api/transactions', transactionRoutes);

// ─── Global 404 Handler ───────────────────────────────────────────────────────
// Catches any request that didn't match a defined route
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Express recognises a 4-parameter middleware as an error handler
// All controllers call next(error) to reach this centralised handler
app.use((err, req, res, next) => {
  console.error('🔥 Unhandled Error:', err.stack || err.message);

  // Mongoose Validation Error — triggered when schema constraints are violated
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(422).json({ success: false, message: messages.join(', ') });
  }

  // Mongoose CastError — typically an invalid ObjectId in route params
  if (err.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid resource identifier.' });
  }

  // JWT errors are handled in the middleware, but catch-all included here
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token has expired.' });
  }

  // Default 500 for all other unhandled errors
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

// Connect to DB first, then start listening for HTTP requests
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
  });
});

module.exports = app; // exported for testing purposes
