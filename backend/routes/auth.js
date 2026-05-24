/**
 * routes/auth.js  (Auth Upgrade — Phase 2)
 *
 * All /api/auth/* endpoints.
 *
 * Public routes:
 * POST   /register              — email/password sign-up (sends verification email)
 * POST   /login                 — email/password login (rejects if !isVerified)
 * GET    /verifyemail/:token    — activates account via link from email
 * POST   /forgotpassword        — sends password-reset email
 * PUT    /resetpassword/:token  — sets new password from reset link
 * POST   /google-login          — Google ID token verification → JWT
 *
 * Protected routes (require Bearer JWT via protect middleware):
 * GET    /me                    — current user profile
 * PUT    /budget                — update monthlyBudget
 * PUT    /profile               — update name, email, avatarColor
 * PUT    /password              — change password
 * DELETE /account               — cascade-delete all user data
 */

const express = require("express");
const { body } = require("express-validator");
const router = express.Router();

const {
  register,
  login,
  verifyEmail,
  forgotPassword,
  resetPassword,
  googleLogin,
  getMe,
  updateBudget,
  updateProfile,
  changePassword,
  deleteAccount,
} = require("../controllers/authController");

const { protect } = require("../middleware/authMiddleware");

// ── Validation rule sets ───────────────────────────────────────────────────
const registerValidation = [
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Full name is required.")
    .isLength({ min: 2 })
    .withMessage("Name must be at least 2 characters.")
    .isLength({ max: 60 })
    .withMessage("Name cannot exceed 60 characters."),
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters."),
  body("monthlyBudget")
    .optional()
    .isNumeric()
    .withMessage("Monthly budget must be a number.")
    .isFloat({ min: 1 })
    .withMessage("Monthly budget must be at least 1."),
];

const loginValidation = [
  body("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .normalizeEmail(),
  body("password").notEmpty().withMessage("Password is required."),
];

// ── Public routes ──────────────────────────────────────────────────────────

// Standard email / password
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);

// Email verification — token comes from the link in the verification email
// Using GET so the browser can hit it directly when the user clicks the link
router.get("/verifyemail/:token", verifyEmail);

// Password reset flow
router.post("/forgotpassword", forgotPassword);
router.put("/resetpassword/:token", resetPassword);

// Google OAuth (Token Verification approach)
// Frontend sends: { token: '<Google ID token from @react-oauth/google>' }
router.post("/google-login", googleLogin);

// ── Protected routes ───────────────────────────────────────────────────────
router.get("/me", protect, getMe);
router.put("/budget", protect, updateBudget);
router.put("/profile", protect, updateProfile);
router.put("/password", protect, changePassword);
router.delete("/account", protect, deleteAccount);

module.exports = router;
