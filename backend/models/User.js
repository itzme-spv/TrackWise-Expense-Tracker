/**
 * models/User.js
 *
 * Mongoose Schema for the User entity.
 *
 * MERN Data Flow note:
 *   When the React Registration form POSTs to /api/auth/register,
 *   the AuthController calls User.create({...}) which validates against
 *   this schema before persisting to MongoDB.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─── Schema Definition ────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required.'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters.'],
      maxlength: [60, 'Name cannot exceed 60 characters.'],
    },

    email: {
      type: String,
      required: [true, 'Email address is required.'],
      unique: true,           // Creates a unique index in MongoDB
      lowercase: true,        // Normalise before storing
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        'Please enter a valid email address.',
      ],
    },

    password: {
      type: String,
      required: [true, 'Password is required.'],
      minlength: [6, 'Password must be at least 6 characters.'],
      select: false, // Never return password field in queries by default
    },

    // Monthly budget goal stored per user (₹ value, e.g. 50000)
    monthlyBudget: {
      type: Number,
      default: 50000,
      min: [1, 'Monthly budget must be at least 1.'],
    },

    // Avatar/profile initials colour — optional UX feature
    avatarColor: {
      type: String,
      default: '#3b82f6', // Tailwind blue-500
    },
  },
  {
    // Automatically adds `createdAt` and `updatedAt` timestamp fields
    timestamps: true,
  }
);

// ─── Pre-Save Hook: Hash Password ─────────────────────────────────────────────
/**
 * Before saving a User document, hash the plain-text password using bcrypt.
 * We only hash if the password field was actually modified (prevents
 * double-hashing on profile updates that don't touch the password).
 */
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  // Salt rounds = 12 — good balance of security vs. computation time
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ─── Instance Method: Compare Password ───────────────────────────────────────
/**
 * matchPassword(candidatePassword)
 * Used in the login controller to verify a plain-text password against
 * the stored bcrypt hash.
 *
 * @param {string} candidatePassword — plain-text password from the login form
 * @returns {Promise<boolean>}
 */
UserSchema.methods.matchPassword = async function (candidatePassword) {
  // `this.password` is available here because we explicitly select it in the
  // auth controller query: User.findOne({ email }).select('+password')
  return await bcrypt.compare(candidatePassword, this.password);
};

// ─── Instance Method: Generate JWT ───────────────────────────────────────────
/**
 * getSignedJwtToken()
 * Creates a signed JWT containing the user's MongoDB ObjectId as payload.
 * React stores this token in localStorage and sends it as a Bearer token
 * in the Authorization header for protected routes.
 *
 * @returns {string} — signed JWT token
 */
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { id: this._id },                     // Payload: just the user id
    process.env.JWT_SECRET,               // Secret from .env
    { expiresIn: process.env.JWT_EXPIRE } // e.g. "7d"
  );
};

// ─── Export Model ─────────────────────────────────────────────────────────────
module.exports = mongoose.model('User', UserSchema);
