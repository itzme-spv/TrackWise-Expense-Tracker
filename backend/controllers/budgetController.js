/**
 * controllers/budgetController.js
 *
 * Budget Controller — business logic for per-category budget limits.
 *
 * Routes handled:
 *   GET    /api/budgets              → getBudgets       (current month's budgets + spend)
 *   POST   /api/budgets              → createOrUpdate   (upsert a category budget)
 *   DELETE /api/budgets/:id          → deleteBudget
 *   GET    /api/budgets/summary      → getBudgetSummary (overall budget health stats)
 *
 * Design Decision — Upsert over separate Create/Update:
 *   Rather than a PUT /:id route that requires knowing the document _id,
 *   createOrUpdate uses MongoDB's { upsert: true } option keyed on
 *   (user_id, category, month, year). This means the frontend simply
 *   POSTs the desired limit and the backend handles create vs update
 *   transparently — simpler React state management.
 *
 * MERN Data Flow:
 *   BudgetsPage → axios.post('/api/budgets', { category, limit, month, year })
 *   → protect middleware (injects req.user)
 *   → createOrUpdate → Budget.findOneAndUpdate(..., { upsert: true })
 *   → returns enriched budget (with spent + percentage)
 *   → React state update → UI re-render (no page reload)
 */

const { validationResult } = require("express-validator");
const Budget = require("../models/Budget");
const { TRANSACTION_CATEGORIES } = require("../models/Transaction");

// ─── Helper: get current month + year ─────────────────────────────────────────
const getCurrentMonthYear = () => {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
};

// ─── @route   GET /api/budgets ────────────────────────────────────────────────
// ─── @access  Private
/**
 * Returns all budget entries for the requested month/year (defaults to current).
 * Each entry is enriched with actual `spent` and `percentage` via the
 * Budget.getBudgetsWithSpend() static aggregation method.
 *
 * Query params:
 *   ?month=5&year=2025  (optional — defaults to current month/year)
 */
const getBudgets = async (req, res, next) => {
  try {
    const { month, year } = getCurrentMonthYear();
    const targetMonth = parseInt(req.query.month) || month;
    const targetYear = parseInt(req.query.year) || year;

    // Validate month/year ranges
    if (targetMonth < 1 || targetMonth > 12) {
      return res
        .status(400)
        .json({ success: false, message: "Month must be between 1 and 12." });
    }
    if (targetYear < 2020) {
      return res
        .status(400)
        .json({ success: false, message: "Year must be 2020 or later." });
    }

    // Use the static method that merges budgets + spend in one aggregation
    const budgets = await Budget.getBudgetsWithSpend(
      req.user._id,
      targetMonth,
      targetYear,
    );

    res.status(200).json({
      success: true,
      month: targetMonth,
      year: targetYear,
      count: budgets.length,
      data: budgets,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   POST /api/budgets ───────────────────────────────────────────────
// ─── @access  Private
/**
 * Create or update a budget entry for a specific category/month/year.
 * Uses MongoDB upsert — if a document matching (user_id, category, month, year)
 * exists it updates the limit; otherwise it creates a new document.
 *
 * Body: { category, limit, month?, year? }
 */
const createOrUpdateBudget = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { month, year } = getCurrentMonthYear();
    const {
      category,
      limit,
      month: reqMonth = month,
      year: reqYear = year,
    } = req.body;

    // Upsert: find by the unique composite key, update the limit field
    const budget = await Budget.findOneAndUpdate(
      {
        user_id: req.user._id,
        category,
        month: parseInt(reqMonth),
        year: parseInt(reqYear),
      },
      { limit: parseFloat(limit) },
      {
        new: true, // Return the updated document
        upsert: true, // Create if not found
        runValidators: true, // Enforce schema validators on update
        setDefaultsOnInsert: true,
      },
    );

    res.status(200).json({
      success: true,
      message: `Budget for ${category} ${budget.month}/${budget.year} saved.`,
      data: budget,
    });
  } catch (error) {
    // Catch the duplicate key error from MongoDB (race condition edge case)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A budget for this category and month already exists.",
      });
    }
    next(error);
  }
};

// ─── @route   DELETE /api/budgets/:id ────────────────────────────────────────
// ─── @access  Private
const deleteBudget = async (req, res, next) => {
  try {
    // Scope delete to the authenticated user — prevents cross-user deletion
    const budget = await Budget.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!budget) {
      return res.status(404).json({
        success: false,
        message: "Budget not found or you are not authorised to delete it.",
      });
    }

    res.status(200).json({
      success: true,
      message: `Budget for ${budget.category} deleted.`,
      data: { _id: budget._id },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   GET /api/budgets/summary ───────────────────────────────────────
// ─── @access  Private
/**
 * Returns high-level budget health stats for the current month:
 *   - Total budget allocated (sum of all category limits)
 *   - Total actually spent against budgeted categories
 *   - Number of categories over budget
 *   - Number of categories under budget
 *
 * Used by the BudgetsPage header strip and the Reports page.
 */
const getBudgetSummary = async (req, res, next) => {
  try {
    const { month, year } = getCurrentMonthYear();
    const targetMonth = parseInt(req.query.month) || month;
    const targetYear = parseInt(req.query.year) || year;

    const budgets = await Budget.getBudgetsWithSpend(
      req.user._id,
      targetMonth,
      targetYear,
    );

    const totalAllocated = budgets.reduce((s, b) => s + b.limit, 0);
    const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
    const overBudgetCount = budgets.filter((b) => b.isOverBudget).length;
    const underBudget = budgets.length - overBudgetCount;

    res.status(200).json({
      success: true,
      data: {
        month: targetMonth,
        year: targetYear,
        totalAllocated,
        totalSpent,
        totalRemaining: totalAllocated - totalSpent,
        overBudgetCount,
        underBudgetCount: underBudget,
        budgetCount: budgets.length,
        healthPercent:
          totalAllocated > 0
            ? parseFloat(((totalSpent / totalAllocated) * 100).toFixed(1))
            : 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getBudgets,
  createOrUpdateBudget,
  deleteBudget,
  getBudgetSummary,
};
