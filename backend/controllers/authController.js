/**
 * controllers/authController.js  (Auth Upgrade — Phase 2)
 *
 * Controllers:
 * register        — hash verification token, email link, do NOT issue JWT yet
 * login           — reject if !isVerified, issue JWT on success
 * verifyEmail     — hash URL token, find user, set isVerified = true
 * forgotPassword  — hash reset token, email link with 15-min expiry
 * resetPassword   — validate token + expiry, set new password, clear token
 * getMe           — return current user from req.user (protect middleware)
 * updateBudget    — update monthlyBudget
 * updateProfile   — update name, email, avatarColor
 * changePassword  — verify current password, set new one
 * deleteAccount   — cascade delete all user data
 * googleLogin     — verify Google ID token, create or retrieve user, issue JWT
 */

const crypto = require("crypto");
const { validationResult } = require("express-validator");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");
const sendEmail = require("../utils/sendEmail");

// Initialise Google OAuth client once — reused across requests
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ── Helper: build and send the JWT response ───────────────────────────────────
const sendTokenResponse = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      avatarColor: user.avatarColor,
      avatarUrl: user.avatarUrl,
      monthlyBudget: user.monthlyBudget,
      isVerified: user.isVerified,
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });

    const { name, email, password, monthlyBudget } = req.body;

    // Reject duplicate emails
    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });

    // Create user — NOT verified yet, no JWT issued
    const user = await User.create({
      name,
      email,
      password, // pre-save hook hashes this
      monthlyBudget: monthlyBudget || 50000,
      isVerified: false,
    });

    // Generate raw token → stored hash saved inside the method
    const rawToken = user.getVerificationToken();
    await user.save({ validateBeforeSave: false });

    // Build the link the user will click in their inbox
    const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${rawToken}`;

    const message = `
      <h2>Welcome to TrackWise, ${name.split(" ")[0]}! 🎉</h2>
      <p>Thank you for signing up. Please verify your email address to activate your account.</p>
      <p style="margin:28px 0;">
        <a href="${verifyUrl}"
           style="background:#10b981;color:#ffffff;padding:12px 28px;
                  border-radius:8px;text-decoration:none;font-weight:700;
                  font-size:15px;">
          Verify My Email
        </a>
      </p>
      <p style="color:#64748b;font-size:13px;">
        This link expires in <strong>24 hours</strong>. If you did not create
        an account, you can safely ignore this email.
      </p>
      <p style="color:#94a3b8;font-size:12px;word-break:break-all;">
        Or copy this link: ${verifyUrl}
      </p>`;

    try {
      await sendEmail({
        email: user.email,
        subject: "TrackWise — Verify Your Email",
        message,
      });
      return res.status(201).json({
        success: true,
        message: `Verification email sent to ${user.email}. Please check your inbox.`,
      });
    } catch (emailErr) {
      // If email fails, roll back the token fields so the user can retry
      user.verificationToken = undefined;
      await user.save({ validateBeforeSave: false });
      console.error("Verification email failed:", emailErr.message);
      return res.status(500).json({
        success: false,
        message:
          "Account created but verification email could not be sent. Please contact support.",
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });

    const { email, password } = req.body;

    // Must select password because it is select:false on the schema
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    // Generic message — avoids user enumeration
    if (!user || !(await user.matchPassword(password)))
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });

    // Block unverified email/password accounts
    if (!user.isVerified)
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message:
          "Please verify your email address before logging in. Check your inbox for the verification link.",
      });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/verifyemail/:token
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const verifyEmail = async (req, res, next) => {
  try {
    // Hash the raw URL token to match what is stored in the DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // Must select verificationToken because it is select:false
    const user = await User.findOne({ verificationToken: hashedToken }).select(
      "+verificationToken",
    );

    if (!user)
      return res.status(400).json({
        success: false,
        message: "Invalid or expired verification link. Please register again.",
      });

    // Mark verified and clear the token — it is single-use
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save({ validateBeforeSave: false });

    // Immediately log them in — good UX, they just verified
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/forgotpassword
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });

    // ✦ BUG FIX: Added .select("+password") so we can actually check if they have one!
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    // Always respond 200 — never reveal whether the email is registered
    if (!user)
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });

    // Google-only accounts have no password to reset
    if (!user.password)
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Please log in with Google.",
      });

    const rawToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

    const message = `
      <h2>Password Reset Request</h2>
      <p>You (or someone else) requested a password reset for your TrackWise account.</p>
      <p style="margin:28px 0;">
        <a href="${resetUrl}"
           style="background:#3b82f6;color:#ffffff;padding:12px 28px;
                  border-radius:8px;text-decoration:none;font-weight:700;
                  font-size:15px;">
          Reset My Password
        </a>
      </p>
      <p style="color:#ef4444;font-size:13px;">
        ⚠️ This link is valid for <strong>15 minutes only</strong>.
      </p>
      <p style="color:#94a3b8;font-size:12px;word-break:break-all;">
        Or copy this link: ${resetUrl}
      </p>`;

    try {
      await sendEmail({
        email: user.email,
        subject: "TrackWise — Password Reset",
        message,
      });
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    } catch (emailErr) {
      // Roll back token fields on email failure
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      console.error("Reset email failed:", emailErr.message);
      return res.status(500).json({
        success: false,
        message: "Could not send reset email. Please try again later.",
      });
    }
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/resetpassword/:token
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6)
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });

    const hashedToken = crypto
      .createHash("sha256")
      .update(req.params.token)
      .digest("hex");

    // Find user with matching token that has NOT expired yet
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }, // still valid
    }).select("+resetPasswordToken +resetPasswordExpire");

    if (!user)
      return res.status(400).json({
        success: false,
        message:
          "Reset link is invalid or has expired. Please request a new one.",
      });

    // Set the new password — pre-save hook will hash it
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // Log them in immediately after successful reset
    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/google-login
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Token Verification approach:
 * 1. Frontend receives a Google credential (ID token) via @react-oauth/google
 * 2. Sends it here as { token: '...' }
 * 3. We verify it server-side using google-auth-library
 * 4. Extract email, name, picture from the verified payload
 * 5. Find or create the user, issue our own JWT
 *
 * Security note: ALWAYS verify the token on the backend.
 * Never trust payload data sent directly from the client.
 */
const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token)
      return res.status(400).json({
        success: false,
        message: "Google credential token is required.",
      });

    // Verify the ID token with Google's public keys
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch (verifyErr) {
      console.error("Google token verification failed:", verifyErr.message);
      return res.status(401).json({
        success: false,
        message: "Invalid Google token. Please try again.",
      });
    }

    const { email, name, picture, sub: googleId } = payload;

    // Try to find an existing user by email
    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      // Existing user — update avatar URL in case it changed, then log in
      // (they might have previously registered with email/password)
      if (picture && !user.avatarUrl) {
        user.avatarUrl = picture;
        await user.save({ validateBeforeSave: false });
      }

      // Edge case: existing email/password user who is not yet verified —
      // Google's verification counts; trust it and mark them verified.
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save({ validateBeforeSave: false });
      }
    } else {
      // New user — create account, skip email verification entirely
      user = await User.create({
        name: name,
        email: email.toLowerCase(),
        avatarUrl: picture || null,
        isVerified: true, // Google already verified the email address
        // No password — this is a Google-only account
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/budget
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateBudget = async (req, res, next) => {
  try {
    const { monthlyBudget } = req.body;
    if (!monthlyBudget || monthlyBudget < 1)
      return res.status(400).json({
        success: false,
        message: "Monthly budget must be at least 1.",
      });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { monthlyBudget },
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Monthly budget updated.",
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

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/profile
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const updateProfile = async (req, res, next) => {
  try {
    const { name, email, avatarColor, monthlyBudget } = req.body;

    if (email && email.toLowerCase() !== req.user.email) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing)
        return res
          .status(409)
          .json({ success: false, message: "That email is already in use." });
    }

    const updates = {};
    if (name) updates.name = name.trim();
    if (email) updates.email = email.toLowerCase().trim();
    if (avatarColor) updates.avatarColor = avatarColor;
    if (monthlyBudget) updates.monthlyBudget = Number(monthlyBudget);

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: "Profile updated.",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatarColor: user.avatarColor,
        avatarUrl: user.avatarUrl,
        monthlyBudget: user.monthlyBudget,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/password
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({
        success: false,
        message: "Both current and new password are required.",
      });
    if (newPassword.length < 6)
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    if (currentPassword === newPassword)
      return res.status(400).json({
        success: false,
        message: "New password must differ from current.",
      });

    const user = await User.findById(req.user._id).select("+password");

    if (!user.password)
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In and has no password.",
      });

    if (!(await user.matchPassword(currentPassword)))
      return res
        .status(401)
        .json({ success: false, message: "Current password is incorrect." });

    user.password = newPassword;
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   DELETE /api/auth/account
// @access  Private
// ─────────────────────────────────────────────────────────────────────────────
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    // Google-only accounts: skip password check, just delete
    if (user.password) {
      if (!password)
        return res.status(400).json({
          success: false,
          message: "Password is required to delete your account.",
        });
      if (!(await user.matchPassword(password)))
        return res
          .status(401)
          .json({ success: false, message: "Incorrect password." });
    }

    // Cascade delete
    await Promise.all([
      Transaction.deleteMany({ user_id: req.user._id }),
      Budget.deleteMany({ user_id: req.user._id }),
      User.findByIdAndDelete(req.user._id),
    ]);

    res
      .status(200)
      .json({ success: true, message: "Account permanently deleted." });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
