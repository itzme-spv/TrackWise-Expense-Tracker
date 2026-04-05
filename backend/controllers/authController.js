/**
 * controllers/authController.js
 *
 * Authentication Controller — contains the business logic for:
 *   - POST /api/auth/register  → registerUser
 *   - POST /api/auth/login     → loginUser
 *   - GET  /api/auth/me        → getMe   (protected)
 *   - PUT  /api/auth/budget    → updateBudget (protected)
 *
 * MERN Data Flow:
 *   Route → Controller (this file) → Mongoose Model → MongoDB → JSON Response → React
 */

const { validationResult } = require('express-validator');
const User = require('../models/User');

// ─── Helper: Send Token Response ─────────────────────────────────────────────
/**
 * Generates a JWT via the User model's instance method and sends it
 * in a standardised JSON envelope.
 *
 * @param {Document} user   — Mongoose User document
 * @param {number}   status — HTTP status code
 * @param {Response} res    — Express response object
 */
const sendTokenResponse = (user, status, res) => {
  const token = user.getSignedJwtToken();

  // Never send the password back, even hashed
  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    monthlyBudget: user.monthlyBudget,
    avatarColor: user.avatarColor,
    createdAt: user.createdAt,
  };

  res.status(status).json({
    success: true,
    token,       // React stores this in localStorage and attaches it to future requests
    user: userData,
  });
};

// ─── @route   POST /api/auth/register ────────────────────────────────────────
// ─── @access  Public
const registerUser = async (req, res, next) => {
  try {
    // 1. Check express-validator results (rules defined in route file)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg, // Return the first validation error
        errors: errors.array(),
      });
    }

    const { name, email, password, monthlyBudget } = req.body;

    // 2. Check for duplicate email
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // 3. Create user — password is hashed automatically by the pre-save hook
    const user = await User.create({
      name,
      email,
      password,
      monthlyBudget: monthlyBudget || 50000,
    });

    // 4. Respond with JWT token + user data
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error); // Pass to global error handler in server.js
  }
};

// ─── @route   POST /api/auth/login ───────────────────────────────────────────
// ─── @access  Public
const loginUser = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // 1. Find user by email — MUST use .select('+password') because
    //    the password field has `select: false` in the schema
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      // Use a generic message to avoid user enumeration attacks
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 2. Compare plain-text password against the stored bcrypt hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // 3. Credentials valid — issue JWT
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─── @route   GET /api/auth/me ────────────────────────────────────────────────
// ─── @access  Private (requires protect middleware)
const getMe = async (req, res, next) => {
  try {
    // req.user is populated by the protect middleware — no need to query DB again
    res.status(200).json({
      success: true,
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   PUT /api/auth/budget ───────────────────────────────────────────
// ─── @access  Private
// Updates the user's monthly budget goal (used by the budget settings widget)
const updateBudget = async (req, res, next) => {
  try {
    const { monthlyBudget } = req.body;

    if (!monthlyBudget || monthlyBudget < 1) {
      return res.status(400).json({
        success: false,
        message: 'Monthly budget must be at least 1.',
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { monthlyBudget },
      { new: true, runValidators: true } // `new` returns the updated document
    );

    res.status(200).json({
      success: true,
      message: 'Monthly budget updated successfully.',
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        monthlyBudget: user.monthlyBudget,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, getMe, updateBudget };
