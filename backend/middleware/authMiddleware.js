/**
 * middleware/authMiddleware.js
 *
 * JWT Authentication Middleware — "protect"
 *
 * How it fits in the MERN Data Flow:
 *   React sends: Authorization: Bearer <token>
 *   Express router calls protect() BEFORE the controller function.
 *   protect() verifies the token, fetches the User from MongoDB,
 *   and attaches it to req.user so controllers can access the
 *   authenticated user without querying the DB again.
 *
 * Usage in routes:
 *   router.get('/', protect, transactionController.getAll);
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

// ─── protect Middleware ───────────────────────────────────────────────────────
const protect = async (req, res, next) => {
  let token;

  // Step 1: Extract token from the Authorization header
  // Expected format: "Authorization: Bearer eyJhbGci..."
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1]; // Extract the token part
  }

  // If no token found, reject the request immediately
  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Access denied. No token provided. Please log in.",
    });
  }

  try {
    // Step 2: Verify the token's signature and expiry using our JWT_SECRET
    // jwt.verify() throws if the token is invalid or expired
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Step 3: Fetch the user from MongoDB using the id embedded in the token payload
    // We explicitly exclude the password field (it's already select:false in schema,
    // but this makes the intention crystal-clear in code reviews)
    const currentUser = await User.findById(decoded.id).select("-password");

    if (!currentUser) {
      // Token is valid but the user no longer exists in the database
      return res.status(401).json({
        success: false,
        message: "The user belonging to this token no longer exists.",
      });
    }

    // Step 4: Attach the full user document to req so downstream controllers
    // can access req.user._id, req.user.name, req.user.email, etc.
    req.user = currentUser;

    // Step 5: Pass control to the next middleware / route handler
    next();
  } catch (error) {
    // Handle specific JWT errors with user-friendly messages
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
    }

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token. Please log in again.",
      });
    }

    // Fallback for any other unexpected error during verification
    return res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

module.exports = { protect };
