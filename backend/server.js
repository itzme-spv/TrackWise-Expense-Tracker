/**
 * server.js — Entry point for the Smart Expense Tracker API
 *
 * Phase A additions (marked ✦):
 *   - express-rate-limit on /api/auth/* (brute-force protection) ✦
 *   - /api/budgets route mounted ✦
 *   - node-cron recurring transaction scheduler started ✦
 *   - Security headers via manual middleware ✦
 *
 * MERN Data Flow:
 *   React (Frontend) → Axios HTTP Request
 *   → Express Router → Controller → Mongoose → MongoDB
 *   MongoDB Response → JSON → React setState → UI re-render
 */

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const dotenv = require("dotenv");
const rateLimit = require("express-rate-limit"); // ✦ Phase A

dotenv.config();

// ─── Route Modules ────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const transactionRoutes = require("./routes/transactions");
const budgetRoutes = require("./routes/budgets"); // ✦ Phase A

// ─── Recurring Job ─────────────────────────────────────────────────────────────
const { startRecurringJob } = require("./jobs/recurringJob"); // ✦ Phase A

// ─── Initialise App ───────────────────────────────────────────────────────────
const app = express();

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — allow the Vite dev server to reach this API
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);

// HTTP request logger (disabled during tests)
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ─── Security Headers (✦ Phase A) ────────────────────────────────────────────
/**
 * Basic security headers without requiring helmet.
 * In production you can replace this block with:
 *   const helmet = require('helmet');
 *   app.use(helmet());
 */
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// ─── Rate Limiting (✦ Phase A) ────────────────────────────────────────────────
/**
 * authLimiter — applied to /api/auth/* only.
 *
 * Allows 15 requests per 15-minute window per IP.
 * This prevents brute-force attacks on the login and register endpoints.
 *
 * The transaction and budget APIs are NOT rate-limited here because they
 * require a valid JWT (the middleware is already a gate), and users
 * legitimately batch many requests on the dashboard page.
 *
 * express-rate-limit config:
 *   windowMs — rolling window duration
 *   max      — max requests per window per IP
 *   message  — JSON sent when limit is hit (matches our API error shape)
 *   standardHeaders — sends RateLimit-* headers (RFC 6585)
 *   legacyHeaders   — suppresses old X-RateLimit-* headers
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many requests from this IP. Please wait 15 minutes and try again.",
  },
  // Skip rate limiting in test environments
  skip: () => process.env.NODE_ENV === "test",
});

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "TrackWise API is running 🚀",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// Auth routes — rate limited (✦)
// /api/auth/register, /api/auth/login, /api/auth/me, /api/auth/budget, /api/auth/account
app.use("/api/auth", authLimiter, authRoutes);

// Transaction routes — JWT protected inside the router
// /api/transactions (CRUD + summary + insights + export + titles + monthly)
app.use("/api/transactions", transactionRoutes);

// Budget routes — JWT protected inside the router (✦)
// /api/budgets (CRUD + summary)
app.use("/api/budgets", budgetRoutes);

// ─── Global 404 ───────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Express identifies a 4-parameter function as an error handler.
// All controllers call next(error) to reach this centralised handler.
app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  console.error("🔥 Unhandled Error:", err.stack || err.message);

  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res
      .status(422)
      .json({ success: false, message: messages.join(", ") });
  }
  if (err.name === "CastError")
    return res
      .status(400)
      .json({ success: false, message: "Invalid resource identifier." });
  if (err.name === "JsonWebTokenError")
    return res.status(401).json({ success: false, message: "Invalid token." });
  if (err.name === "TokenExpiredError")
    return res
      .status(401)
      .json({
        success: false,
        message: "Token has expired. Please log in again.",
      });
  if (err.code === 11000) {
    // MongoDB duplicate key error
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return res
      .status(409)
      .json({
        success: false,
        message: `Duplicate value for ${field}. Please use a different value.`,
      });
  }

  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ─── Database Connection ──────────────────────────────────────────────────────
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅  MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌  MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
  });

  // ✦ Phase A — Start the recurring transaction cron job AFTER DB connects.
  // The job queries MongoDB, so it must start only when the connection is ready.
  // It runs daily at 00:05 IST and also fires once immediately on startup
  // to catch any transactions that were due while the server was down.
  startRecurringJob();
});

module.exports = app;
