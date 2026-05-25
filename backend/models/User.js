/**
 * models/User.js  (Portfolio Bypass — Auto-Verified)
 */

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

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
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters."],
      select: false,
    },
    monthlyBudget: {
      type: Number,
      default: 50000,
      min: [1, "Monthly budget must be at least 1."],
    },
    avatarColor: {
      type: String,
      default: "#10b981",
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    // Auto-verify all users for public portfolio access
    isVerified: {
      type: Boolean,
      default: true,
    },
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true },
);

// ── Pre-Save Hook: Hash Password ─────────────────────────────────────────────
UserSchema.pre("save", async function (next) {
  if (!this.password || !this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Instance Method: Compare Password ───────────────────────────────────────
UserSchema.methods.matchPassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: Generate JWT ───────────────────────────────────────────
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// ── Instance Method: Generate Password Reset Token ──────────────────────────
UserSchema.methods.getResetPasswordToken = function () {
  const rawToken = crypto.randomBytes(32).toString("hex");

  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  this.resetPasswordExpire = Date.now() + 15 * 60 * 1000;

  return rawToken;
};

module.exports = mongoose.model("User", UserSchema);
