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

// ─── @route   DELETE /api/auth/account ───────────────────────────────────────
// ─── @access  Private
// ─── Phase A ✦ — Permanently deletes the user account and ALL their data
/**
 * Performs a hard delete of:
 *   1. All Transaction documents belonging to this user
 *   2. All Budget documents belonging to this user
 *   3. The User document itself
 *
 * Requires the user to confirm their password in the request body as a
 * safety gate — prevents accidental deletion via a stale authenticated session.
 *
 * MERN Data Flow:
 *   SettingsPage → axios.delete('/api/auth/account', { data: { password } })
 *   → protect middleware → deleteAccount
 *   → Transaction.deleteMany + Budget.deleteMany + User.findByIdAndDelete
 *   → AuthContext.logout() on frontend → Navigate('/login')
 */
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your password to confirm account deletion.',
      });
    }

    // Re-fetch user WITH password field (it's select:false in the schema)
    const user = await User.findById(req.user._id).select('+password');

    // Verify the provided password against the stored bcrypt hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Account deletion cancelled.',
      });
    }

    // Lazy-require to avoid circular dependency issues at module load time
    const Transaction = require('../models/Transaction');
    const Budget      = require('../models/Budget');

    // Delete all user data — run in parallel for efficiency
    await Promise.all([
      Transaction.deleteMany({ user_id: req.user._id }),
      Budget.deleteMany({ user_id: req.user._id }),
    ]);

    // Finally delete the user document itself
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: 'Account and all associated data permanently deleted.',
    });
  } catch (error) {
    next(error);
  }
};


// ─── @route   PUT /api/auth/profile ──────────────────────────────────────────
// ─── @access  Private  (Phase C)
/**
 * Updates the authenticated user's name, email, avatarColor, and monthlyBudget.
 * Email uniqueness is re-checked if the email is being changed.
 *
 * MERN Data Flow:
 *   SettingsPage form → axios.put('/api/auth/profile', { name, email, avatarColor })
 *   → protect middleware → updateProfile → User.findByIdAndUpdate
 *   → updated doc → AuthContext.updateUser(updates) → Navbar re-renders
 */
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, avatarColor, monthlyBudget } = req.body;

    // If changing email, verify it isn't already taken by another account
    if (email && email.toLowerCase() !== req.user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'That email address is already in use by another account.',
        });
      }
    }

    // Build partial update — only include defined fields
    const updates = {};
    if (name)          updates.name         = name.trim();
    if (email)         updates.email        = email.toLowerCase().trim();
    if (avatarColor)   updates.avatarColor  = avatarColor;
    if (monthlyBudget) updates.monthlyBudget = Number(monthlyBudget);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updates,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: {
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        avatarColor:   user.avatarColor,
        monthlyBudget: user.monthlyBudget,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   PUT /api/auth/password ─────────────────────────────────────────
// ─── @access  Private  (Phase C)
/**
 * Changes the authenticated user's password.
 * Requires the current password for re-verification before hashing the new one.
 *
 * MERN Data Flow:
 *   SettingsPage → axios.put('/api/auth/password', { currentPassword, newPassword })
 *   → protect middleware → changePassword
 *   → User.findById (with +password) → bcrypt.compare → user.password = new → save()
 *   → pre-save hook auto-hashes the new password → 200 OK
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Both current and new password are required.',
      });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters.',
      });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password.',
      });
    }

    // Re-fetch with password field (select:false in schema)
    const user = await User.findById(req.user._id).select('+password');

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    // Assign the new plain-text password — the pre-save hook hashes it
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password changed successfully. Please log in again.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { registerUser, loginUser, getMe, updateBudget, deleteAccount, updateProfile, changePassword };