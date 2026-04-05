/**
 * routes/auth.js
 *
 * Authentication Routes
 * Mounted at: /api/auth  (see server.js)
 *
 * Endpoint map:
 *   POST   /api/auth/register  → Register a new user
 *   POST   /api/auth/login     → Login and receive JWT
 *   GET    /api/auth/me        → Get current user profile (protected)
 *   PUT    /api/auth/budget    → Update monthly budget goal (protected)
 *
 * express-validator rules are defined HERE (in the route) to keep
 * controllers clean — the controller simply calls validationResult(req).
 */

const express = require('express');
const { body } = require('express-validator');

// Import controller functions (business logic)
const {
  registerUser,
  loginUser,
  getMe,
  updateBudget,
} = require('../controllers/authController');

// Import the JWT protect middleware
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── Validation Rule Sets ─────────────────────────────────────────────────────

/** Rules applied to POST /register */
const registerValidation = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters.')
    .isLength({ max: 60 }).withMessage('Name cannot exceed 60 characters.'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 6 }).withMessage('Password must be at least 6 characters.'),

  body('monthlyBudget')
    .optional()
    .isNumeric().withMessage('Monthly budget must be a number.')
    .isFloat({ min: 1 }).withMessage('Monthly budget must be at least 1.'),
];

/** Rules applied to POST /login */
const loginValidation = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.'),
];

// ─── Route Definitions ────────────────────────────────────────────────────────

// @route   POST /api/auth/register
// @desc    Register a new user account
// @access  Public
router.post('/register', registerValidation, registerUser);

// @route   POST /api/auth/login
// @desc    Authenticate user and return JWT
// @access  Public
router.post('/login', loginValidation, loginUser);

// @route   GET /api/auth/me
// @desc    Return the currently authenticated user's profile
// @access  Private — protect middleware verifies JWT before getMe runs
router.get('/me', protect, getMe);

// @route   PUT /api/auth/budget
// @desc    Update the user's monthly budget goal
// @access  Private
router.put('/budget', protect, updateBudget);

module.exports = router;
