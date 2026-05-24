/**
 * models/User.js  (Auth Upgrade — Email Verification + Google OAuth)
 *
 * New fields:
 *   isVerified          — email/password users must verify before logging in
 *   verificationToken   — hashed token stored in DB; raw sent in email link
 *   resetPasswordToken  — hashed reset token (expires in 15 minutes)
 *   resetPasswordExpire — expiry timestamp for reset token
 *   avatarUrl           — Google profile picture URL (null for email users)
 *
 * Password is NOT globally required because Google OAuth users have no password.
 * The controller validates its presence for email/password registration.
 *
 * New instance methods (use built-in `crypto` — no extra package needed):
 *   getVerificationToken()  — generates raw token, stores SHA-256 hash, returns raw
 *   getResetPasswordToken() — same pattern + sets 15-min expiry
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto"); // Node built-in

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Full name is required."],
      trim: true,
      minlength: [2, "Name must be at least 2 characters."],
      maxlength: [60, "Name cannot exceed 60 characters."],
    },

    email: {
      type: String,
      required: [true, "Email address is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email address.",
      ],
    },

    // NOT required at schema level — Google users have no password.
    // The register controller enforces it for email/password sign-up.
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters."],
      select: false, // Never returned in queries by default
    },

    monthlyBudget: {
      type: Number,
      default: 50000,
      min: [1, "Monthly budget must be at least 1."],
    },

    // Hex colour for the initials avatar (used when no avatarUrl)
    avatarColor: {
      type: String,
      default: "#10b981",
    },

    // ── Auth Upgrade fields ──────────────────────────────────────────────────

    // Google profile picture; null for email/password users
    avatarUrl: {
      type: String,
      default: null,
    },

    // false until the user clicks the verification link in their inbox.
    // Google users are created with isVerified: true (Google already verified).
    isVerified: {
      type: Boolean,
      default: false,
    },

    // SHA-256 hash of the raw token sent in the verification email.
    // select: false so it is never accidentally exposed in API responses.
    verificationToken: {
      type: String,
      select: false,
    },

    // SHA-256 hash of the raw reset token sent in the forgot-password email.
    resetPasswordToken: {
      type: String,
      select: false,
    },

    // Unix timestamp — token is only valid while Date.now() < this value.
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

// ── Pre-Save Hook: Hash Password ─────────────────────────────────────────────
// Runs only when the password field exists AND was modified (prevents
// double-hashing on profile updates, and skips Google-only accounts).
UserSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance Method: Compare Password ───────────────────────────────────────
UserSchema.methods.matchPassword = async function (candidatePassword) {
  if (!this.password) return false; // Google-only accounts have no password
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: Generate JWT ───────────────────────────────────────────
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ── Instance Method: Generate Email Verification Token ──────────────────────
/**
 * 1. Generate 32 random bytes → hex string  (this is the RAW token)
 * 2. SHA-256 hash it           → store the HASH in DB  (verificationToken)
 * 3. Return the RAW token      → embed in the email link
 *
 * Why hash? If the DB is ever leaked, attackers can't use the hash directly.
 * The controller hashes the URL token before comparing to the DB value.
 */
UserSchema.methods.getVerificationToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");

  this.verificationToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return rawToken; // Send THIS in the email link
};

// ── Instance Method: Generate Password Reset Token ──────────────────────────
/**
 * Same hash-and-store pattern as verification, plus a 15-minute expiry.
 */
UserSchema.methods.getResetPasswordToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  // 15 minutes from now
  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return rawToken;
};

module.exports = mongoose.model("User", UserSchema);
