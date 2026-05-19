/**
 * models/Budget.js
 *
 * Mongoose Schema for per-category monthly Budget limits.
 *
 * Each document represents ONE category budget for ONE user for ONE month.
 * This design allows users to set different limits per month and track
 * how actual spending (from Transaction documents) compares to the limit.
 *
 * Example document:
 *   {
 *     user_id:   ObjectId("..."),
 *     category:  "Food & Groceries",
 *     limit:     8000,
 *     month:     5,     // May
 *     year:      2025,
 *   }
 *
 * The budgetController fetches matching Transaction aggregates and attaches
 * `spent` and `percentage` to each budget before returning to the frontend.
 *
 * MERN Data Flow:
 *   BudgetsPage → GET /api/budgets → budgetController.getBudgets()
 *   → Budget.find({ user_id }) + Transaction.aggregate(...)
 *   → merged array with { limit, spent, percentage } → React state → UI
 */

const mongoose = require("mongoose");
const { TRANSACTION_CATEGORIES } = require("./Transaction");

// ─── Schema ───────────────────────────────────────────────────────────────────
const BudgetSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Budget must belong to a user."],
      index: true,
    },

    category: {
      type: String,
      required: [true, "Category is required."],
      enum: {
        values: TRANSACTION_CATEGORIES,
        message: `Category must be one of: ${TRANSACTION_CATEGORIES.join(", ")}.`,
      },
    },

    // The spending limit in ₹ for this category this month
    limit: {
      type: Number,
      required: [true, "Budget limit is required."],
      min: [1, "Budget limit must be at least ₹1."],
    },

    // Month (1–12) and Year allow per-month budget tracking
    month: {
      type: Number,
      required: [true, "Month is required."],
      min: [1, "Month must be between 1 and 12."],
      max: [12, "Month must be between 1 and 12."],
    },

    year: {
      type: Number,
      required: [true, "Year is required."],
      min: [2020, "Year must be 2020 or later."],
    },
  },
  {
    timestamps: true,
  },
);

// ─── Compound Unique Index ────────────────────────────────────────────────────
// A user can have only ONE budget entry per category per month/year.
// This prevents duplicates and allows safe upsert operations.
BudgetSchema.index(
  { user_id: 1, category: 1, month: 1, year: 1 },
  { unique: true },
);

// ─── Static: getBudgetsWithSpend ──────────────────────────────────────────────
/**
 * Fetches all budget documents for a user in a given month/year and
 * enriches each with actual spending data from the Transaction collection.
 * Performed in a single aggregation pipeline — no N+1 queries.
 *
 * @param {ObjectId} userId
 * @param {number}   month  (1–12)
 * @param {number}   year
 * @returns {Promise<Array<BudgetWithSpend>>}
 *
 * Each returned object shape:
 * {
 *   _id, category, limit, month, year,
 *   spent:      number,  // actual ₹ spent in that category this month
 *   remaining:  number,  // limit - spent (can be negative if over budget)
 *   percentage: number,  // (spent / limit) * 100, capped at display level in frontend
 *   isOverBudget: boolean
 * }
 */
BudgetSchema.statics.getBudgetsWithSpend = async function (
  userId,
  month,
  year,
) {
  const Transaction = mongoose.model("Transaction");

  // 1. Fetch this user's budget documents for the given month/year
  const budgets = await this.find({ user_id: userId, month, year }).lean();

  if (budgets.length === 0) return [];

  // 2. Build date range for the target month (start of month → end of month)
  const startDate = new Date(year, month - 1, 1); // e.g., 2025-05-01 00:00:00
  const endDate = new Date(year, month, 0, 23, 59, 59); // e.g., 2025-05-31 23:59:59

  // 3. Aggregate actual spend per category in this date range for this user
  const spendByCategory = await Transaction.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        type: "Expense",
        date: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $group: {
        _id: "$category",
        spent: { $sum: "$amount" },
      },
    },
  ]);

  // 4. Create a quick lookup map: { 'Food & Groceries': 4200, ... }
  const spendMap = {};
  spendByCategory.forEach((s) => {
    spendMap[s._id] = s.spent;
  });

  // 5. Merge spending data into each budget document
  return budgets.map((budget) => {
    const spent = spendMap[budget.category] || 0;
    const remaining = budget.limit - spent;
    const percentage =
      budget.limit > 0
        ? parseFloat(((spent / budget.limit) * 100).toFixed(1))
        : 0;

    return {
      ...budget,
      spent,
      remaining,
      percentage,
      isOverBudget: spent > budget.limit,
    };
  });
};

// ─── Export ───────────────────────────────────────────────────────────────────
module.exports = mongoose.model("Budget", BudgetSchema);
