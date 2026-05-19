/**
 * routes/budgets.js
 *
 * Budget Routes
 * Mounted at: /api/budgets  (see updated server.js)
 *
 * ALL routes require JWT authentication via router.use(protect).
 *
 * Endpoint map:
 *   GET    /api/budgets          → Get current month's budgets with spend data
 *   POST   /api/budgets          → Create or update a category budget (upsert)
 *   DELETE /api/budgets/:id      → Delete a budget by ObjectId
 *   GET    /api/budgets/summary  → Get overall budget health stats
 *
 * Route ordering:
 *   /summary MUST be defined before /:id — same reason as in transactions.js
 */

const express = require("express");
const { body } = require("express-validator");
const {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget,
  getBudgetSummary,
} = require("../controllers/budgetController");
const { protect } = require("../middleware/authMiddleware");
const { TRANSACTION_CATEGORIES } = require("../models/Transaction");

const router = express.Router();

// Apply JWT protection to every route in this router
router.use(protect);

// ─── Validation rules for POST /api/budgets ───────────────────────────────────
const budgetValidation = [
  body("category")
    .notEmpty()
    .withMessage("Category is required.")
    .isIn(TRANSACTION_CATEGORIES)
    .withMessage("Invalid category."),

  body("limit")
    .notEmpty()
    .withMessage("Limit is required.")
    .isNumeric()
    .withMessage("Limit must be a number.")
    .isFloat({ min: 1 })
    .withMessage("Limit must be at least ₹1."),

  body("month")
    .optional()
    .isInt({ min: 1, max: 12 })
    .withMessage("Month must be between 1 and 12."),

  body("year")
    .optional()
    .isInt({ min: 2020 })
    .withMessage("Year must be 2020 or later."),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// @route   GET /api/budgets/summary
// @desc    Get overall budget health for a month (?month=&year=)
// @access  Private — MUST be before /:id
router.get("/summary", getBudgetSummary);

// @route   GET /api/budgets
// @desc    List all budgets with actual spend for a given month (?month=&year=)
// @access  Private
router.get("/", getBudgets);

// @route   POST /api/budgets
// @desc    Create or update (upsert) a category budget
// @access  Private
router.post("/", budgetValidation, createOrUpdateBudget);

// @route   DELETE /api/budgets/:id
// @desc    Remove a budget entry by its MongoDB ObjectId
// @access  Private
router.delete("/:id", deleteBudget);

module.exports = router;
