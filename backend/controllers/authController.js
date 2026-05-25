/**
 * controllers/authController.js  (Portfolio Bypass — Auto-Verified)
 */

const crypto = require("crypto");
const { validationResult } = require("express-validator");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const Budget = require("../models/Budget");

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
// ─────────────────────────────────────────────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });

    const { name, email, password, monthlyBudget } = req.body;

    if (await User.findOne({ email: email.toLowerCase() }))
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });

    // Create user — instantly verified for public portfolio access
    const user = await User.create({
      name,
      email,
      password,
      monthlyBudget: monthlyBudget || 50000,
      isVerified: true,
    });

    // Instantly log them in and redirect to dashboard
    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ success: false, message: errors.array()[0].msg });

    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user || !(await user.matchPassword(password)))
      return res
        .status(401)
        .json({ success: false, message: "Invalid email or password." });

    // Keeping this block as a safety net, though users are auto-verified now
    if (!user.isVerified)
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: "Please verify your email address before logging in.",
      });

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/forgotpassword
// ─────────────────────────────────────────────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email)
      return res
        .status(400)
        .json({ success: false, message: "Email is required." });

    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+password",
    );

    if (!user)
      return res.status(200).json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });

    if (!user.password)
      return res.status(400).json({
        success: false,
        message: "This account uses Google Sign-In. Please log in with Google.",
      });

    const rawToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL}/reset-password/${rawToken}`;

    // Development Bypass: Print the URL to the server console instead of emailing it
    console.log(`\n=== PASSWORD RESET REQUESTED ===`);
    console.log(`Email: ${user.email}`);
    console.log(`Reset Link: ${resetUrl}`);
    console.log(`================================\n`);

    return res.status(200).json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PUT /api/auth/resetpassword/:token
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

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    }).select("+resetPasswordToken +resetPasswordExpire");

    if (!user)
      return res.status(400).json({
        success: false,
        message:
          "Reset link is invalid or has expired. Please request a new one.",
      });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/auth/google-login
// ─────────────────────────────────────────────────────────────────────────────
const googleLogin = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token)
      return res.status(400).json({
        success: false,
        message: "Google credential token is required.",
      });

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

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (picture && !user.avatarUrl) {
        user.avatarUrl = picture;
        await user.save({ validateBeforeSave: false });
      }
      if (!user.isVerified) {
        user.isVerified = true;
        await user.save({ validateBeforeSave: false });
      }
    } else {
      user = await User.create({
        name: name,
        email: email.toLowerCase(),
        avatarUrl: picture || null,
        isVerified: true,
      });
    }

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/auth/me
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
// ─────────────────────────────────────────────────────────────────────────────
const deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select("+password");

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
  forgotPassword,
  resetPassword,
  googleLogin,
  getMe,
  updateBudget,
  updateProfile,
  changePassword,
  deleteAccount,
};
