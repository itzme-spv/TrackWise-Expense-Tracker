/**
 * controllers/transactionController.js
 *
 * Transaction Controller — single, clean Phase A implementation.
 *
 * Route map:
 * GET    /api/transactions          → getAllTransactions  (filter / pagination / date range)
 * POST   /api/transactions          → createTransaction   (supports isRecurring)
 * PUT    /api/transactions/:id      → editTransaction     (Phase A)
 * DELETE /api/transactions/:id      → deleteTransaction
 * GET    /api/transactions/summary  → getSummary          (date-range aware)
 * GET    /api/transactions/insights → getInsights         (locked to current month)
 * GET    /api/transactions/export   → exportCSV
 * GET    /api/transactions/titles   → getTitleSuggestions (Phase A — autocomplete)
 * GET    /api/transactions/monthly  → getMonthlyTrend     (Phase A — reports)
 *
 * ALL routes are PROTECTED — req.user is injected by authMiddleware.protect.
 */

const { validationResult } = require("express-validator");
const Transaction = require("../models/Transaction");
const { TRANSACTION_CATEGORIES } = require("../models/Transaction");

// ─── GET /api/transactions ────────────────────────────────────────────────────
const getAllTransactions = async (req, res, next) => {
  try {
    const filter = { user_id: req.user._id };

    if (req.query.type && ["Income", "Expense"].includes(req.query.type))
      filter.type = req.query.type;

    if (
      req.query.category &&
      TRANSACTION_CATEGORIES.includes(req.query.category)
    )
      filter.category = req.query.category;

    if (req.query.search && req.query.search.trim())
      filter.title = { $regex: req.query.search.trim(), $options: "i" };

    // Date range — History page date picker: ?from=YYYY-MM-DD&to=YYYY-MM-DD
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = new Date(req.query.from);
      if (req.query.to) {
        const to = new Date(req.query.to);
        to.setHours(23, 59, 59, 999);
        filter.date.$lte = to;
      }
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    const [transactions, totalCount] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      count: transactions.length,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      currentPage: page,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/transactions ───────────────────────────────────────────────────
const createTransaction = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });

    const {
      title,
      amount,
      type,
      category,
      date,
      notes,
      isRecurring,
      recurringFrequency,
    } = req.body;

    if (isRecurring && !recurringFrequency)
      return res.status(400).json({
        success: false,
        message: "Recurring frequency is required when isRecurring is true.",
      });

    const transaction = await Transaction.create({
      title,
      amount,
      type,
      category,
      date: date || Date.now(),
      notes: notes || "",
      user_id: req.user._id, // From JWT — never from body
      isRecurring: !!isRecurring,
      recurringFrequency: isRecurring ? recurringFrequency : null,
      lastGeneratedAt: isRecurring ? new Date() : null,
    });

    res.status(201).json({
      success: true,
      message: "Transaction added successfully.",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// ─── PUT /api/transactions/:id  (Phase A) ─────────────────────────────────────
const editTransaction = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });

    const {
      title,
      amount,
      type,
      category,
      date,
      notes,
      isRecurring,
      recurringFrequency,
    } = req.body;

    if (isRecurring && !recurringFrequency)
      return res.status(400).json({
        success: false,
        message: "Recurring frequency is required when isRecurring is true.",
      });

    // Build partial update — only include fields that were actually sent
    const upd = {};
    if (title !== undefined) upd.title = title;
    if (amount !== undefined) upd.amount = Number(amount);
    if (type !== undefined) upd.type = type;
    if (category !== undefined) upd.category = category;
    if (date !== undefined) upd.date = new Date(date);
    if (notes !== undefined) upd.notes = notes;
    if (isRecurring !== undefined) {
      upd.isRecurring = !!isRecurring;
      upd.recurringFrequency = isRecurring ? recurringFrequency : null;
    }

    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { $set: upd },
      { new: true, runValidators: true },
    );

    if (!transaction)
      return res.status(404).json({
        success: false,
        message: "Transaction not found or you are not authorised to edit it.",
      });

    res.status(200).json({
      success: true,
      message: "Transaction updated successfully.",
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/transactions/:id ─────────────────────────────────────────────
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!transaction)
      return res.status(404).json({
        success: false,
        message:
          "Transaction not found or you are not authorised to delete it.",
      });

    res.status(200).json({
      success: true,
      message: "Transaction deleted successfully.",
      data: { _id: transaction._id },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/transactions/summary ───────────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const options = {};
    if (req.query.from) options.from = req.query.from;
    if (req.query.to) options.to = req.query.to;

    const [summary, categoryBreakdown] = await Promise.all([
      Transaction.getSummaryForUser(req.user._id, options),
      Transaction.getCategoryBreakdownForUser(req.user._id, options),
    ]);

    const monthlyBudget = req.user.monthlyBudget || 50000;
    const budgetUsedPercent =
      monthlyBudget > 0
        ? Math.min(
            100,
            parseFloat(
              ((summary.totalExpense / monthlyBudget) * 100).toFixed(1),
            ),
          )
        : 0;

    res.status(200).json({
      success: true,
      data: { ...summary, monthlyBudget, budgetUsedPercent, categoryBreakdown },
    });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/transactions/insights ──────────────────────────────────────────
const getInsights = async (req, res, next) => {
  try {
    // ✦ Fix: Insights should always evaluate the CURRENT month's budget health
    const now = new Date();
    const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const toDate = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    const options = { from: fromDate.toISOString(), to: toDate.toISOString() };

    const [summary, breakdown] = await Promise.all([
      Transaction.getSummaryForUser(req.user._id, options),
      Transaction.getCategoryBreakdownForUser(req.user._id, options),
    ]);

    const insights = [];

    // Rule 1 — Food & Groceries > 40% of total expenses
    const food = breakdown.find((c) => c.category === "Food & Groceries");
    if (food && summary.totalExpense > 0) {
      const pct = (food.total / summary.totalExpense) * 100;
      if (pct > 40)
        insights.push({
          type: "warning",
          code: "FOOD_OVERSPEND",
          message: `⚠️ Food & Groceries is ${pct.toFixed(1)}% of your expenses — consider cutting dining out.`,
        });
    }

    // Rule 2 — Savings rate ≥ 20%
    if (summary.totalIncome > 0 && summary.totalExpense > 0) {
      const rate =
        ((summary.totalIncome - summary.totalExpense) / summary.totalIncome) *
        100;
      if (rate >= 20)
        insights.push({
          type: "success",
          code: "GOOD_SAVINGS",
          message: `🎉 You're saving ${rate.toFixed(1)}% of your income — great discipline!`,
        });
    }

    // Rule 3 — Budget exceeded
    const budget = req.user.monthlyBudget || 50000;
    if (summary.totalExpense > budget)
      insights.push({
        type: "danger",
        code: "BUDGET_EXCEEDED",
        message: `🚨 Monthly budget of ₹${budget.toLocaleString("en-IN")} exceeded by ₹${(summary.totalExpense - budget).toLocaleString("en-IN")}.`,
      });

    res.status(200).json({ success: true, data: { insights, summary } });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/transactions/export ────────────────────────────────────────────
const exportCSV = async (req, res, next) => {
  try {
    const transactions = await Transaction.find({ user_id: req.user._id })
      .sort({ date: -1 })
      .lean();

    if (transactions.length === 0)
      return res
        .status(404)
        .json({ success: false, message: "No transactions to export." });

    const headers = [
      "Date",
      "Title",
      "Category",
      "Type",
      "Amount (₹)",
      "Notes",
      "Recurring",
      "Frequency",
      "Auto-Generated",
    ];

    const rows = transactions.map((t) =>
      [
        new Date(t.date).toLocaleDateString("en-IN"),
        `"${t.title.replace(/"/g, '""')}"`,
        t.category,
        t.type,
        t.amount,
        `"${(t.notes || "").replace(/"/g, '""')}"`,
        t.isRecurring ? "Yes" : "No",
        t.recurringFrequency || "",
        t.isGeneratedCopy ? "Yes" : "No",
      ].join(","),
    );

    const csv = [headers.join(","), ...rows].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="trackwise_export_${Date.now()}.csv"`,
    );
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/transactions/titles  (Phase A — autocomplete) ──────────────────
const getTitleSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 1)
      return res.status(200).json({ success: true, data: [] });

    const suggestions = await Transaction.getTitleSuggestions(
      req.user._id,
      q.trim(),
      8,
    );
    res.status(200).json({ success: true, data: suggestions });
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/transactions/monthly  (Phase A — reports charts) ───────────────
const getMonthlyTrend = async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months) || 6));
    const trend = await Transaction.getMonthlyTrend(req.user._id, months);
    res.status(200).json({ success: true, months, data: trend });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTransactions,
  createTransaction,
  editTransaction,
  deleteTransaction,
  getSummary,
  getInsights,
  exportCSV,
  getTitleSuggestions,
  getMonthlyTrend,
};
