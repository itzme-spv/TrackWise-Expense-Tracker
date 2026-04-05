/**
 * controllers/transactionController.js
 *
 * Transaction Controller — business logic for all transaction operations:
 *   GET    /api/transactions          → getAllTransactions  (with filter/pagination)
 *   POST   /api/transactions          → createTransaction
 *   DELETE /api/transactions/:id      → deleteTransaction
 *   GET    /api/transactions/summary  → getSummary
 *   GET    /api/transactions/insights → getInsights
 *   GET    /api/transactions/export   → exportCSV
 *
 * All routes are PROTECTED — req.user is injected by authMiddleware.protect.
 *
 * MERN Data Flow:
 *   React state change → axios.post('/api/transactions', data, { headers: { Authorization: 'Bearer <token>' } })
 *   → protect middleware → this controller → Mongoose → MongoDB → JSON → React setState
 */

const { validationResult } = require('express-validator');
const Transaction = require('../models/Transaction');
const { TRANSACTION_CATEGORIES } = require('../models/Transaction');

// ─── @route   GET /api/transactions ──────────────────────────────────────────
// ─── @access  Private
// Supports query params: ?page=1&limit=10&type=Expense&category=Food&search=coffee
const getAllTransactions = async (req, res, next) => {
  try {
    // ── Build dynamic filter object ──────────────────────────────────────────
    const filter = { user_id: req.user._id }; // Always scope to the logged-in user

    // Filter by Type (Income | Expense)
    if (req.query.type && ['Income', 'Expense'].includes(req.query.type)) {
      filter.type = req.query.type;
    }

    // Filter by Category
    if (req.query.category && TRANSACTION_CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }

    // Full-text search on title using a case-insensitive regex
    if (req.query.search && req.query.search.trim() !== '') {
      filter.title = { $regex: req.query.search.trim(), $options: 'i' };
    }

    // ── Pagination ────────────────────────────────────────────────────────────
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // ── Execute queries in parallel for performance ───────────────────────────
    const [transactions, totalCount] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1 })   // Most recent first
        .skip(skip)
        .limit(limit)
        .lean(),              // .lean() returns plain JS objects — faster for reads
      Transaction.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    res.status(200).json({
      success: true,
      count: transactions.length,
      totalCount,
      totalPages,
      currentPage: page,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   POST /api/transactions ─────────────────────────────────────────
// ─── @access  Private
const createTransaction = async (req, res, next) => {
  try {
    // Validate request body using express-validator rules (defined in route file)
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { title, amount, type, category, date, notes } = req.body;

    // Create and save the transaction — user_id comes from JWT (protect middleware)
    const transaction = await Transaction.create({
      title,
      amount,
      type,
      category,
      date: date || Date.now(),
      notes: notes || '',
      user_id: req.user._id, // Securely injected — never trusted from the client body
    });

    res.status(201).json({
      success: true,
      message: 'Transaction added successfully.',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   DELETE /api/transactions/:id ───────────────────────────────────
// ─── @access  Private
const deleteTransaction = async (req, res, next) => {
  try {
    // Find by both _id AND user_id — prevents a user from deleting another user's transaction
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or you are not authorised to delete it.',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Transaction deleted successfully.',
      data: { _id: transaction._id },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   GET /api/transactions/summary ──────────────────────────────────
// ─── @access  Private
// Returns Total Income, Total Expense, Balance, and Category Breakdown
// Called on every Dashboard mount and after every transaction mutation
const getSummary = async (req, res, next) => {
  try {
    // Use the static aggregation methods defined on the Transaction model
    const [summary, categoryBreakdown] = await Promise.all([
      Transaction.getSummaryForUser(req.user._id),
      Transaction.getCategoryBreakdownForUser(req.user._id),
    ]);

    // Include the user's budget for the progress bar calculation
    const monthlyBudget = req.user.monthlyBudget || 50000;
    const budgetUsedPercent = Math.min(
      100,
      parseFloat(((summary.totalExpense / monthlyBudget) * 100).toFixed(1))
    );

    res.status(200).json({
      success: true,
      data: {
        ...summary,
        monthlyBudget,
        budgetUsedPercent,
        categoryBreakdown,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   GET /api/transactions/insights ─────────────────────────────────
// ─── @access  Private
// Computes smart spending insights for the Alert Banner on the Dashboard
const getInsights = async (req, res, next) => {
  try {
    const summary = await Transaction.getSummaryForUser(req.user._id);
    const breakdown = await Transaction.getCategoryBreakdownForUser(req.user._id);

    const insights = [];

    // ── Insight 1: Food & Groceries > 40% of total expenses ─────────────────
    const foodCategory = breakdown.find((c) => c.category === 'Food & Groceries');
    if (foodCategory && summary.totalExpense > 0) {
      const foodPercent = (foodCategory.total / summary.totalExpense) * 100;
      if (foodPercent > 40) {
        insights.push({
          type: 'warning',
          code: 'FOOD_OVERSPEND',
          message: `⚠️ Food & Groceries accounts for ${foodPercent.toFixed(1)}% of your expenses — consider reducing dining out.`,
        });
      }
    }

    // ── Insight 2: Income > Expense by more than 20% ─────────────────────────
    if (summary.totalIncome > 0 && summary.totalExpense > 0) {
      const savingsRate =
        ((summary.totalIncome - summary.totalExpense) / summary.totalIncome) * 100;
      if (savingsRate >= 20) {
        insights.push({
          type: 'success',
          code: 'GOOD_SAVINGS',
          message: `🎉 Great job! You're saving ${savingsRate.toFixed(1)}% of your income this period.`,
        });
      }
    }

    // ── Insight 3: Budget overrun ─────────────────────────────────────────────
    const budget = req.user.monthlyBudget || 50000;
    if (summary.totalExpense > budget) {
      insights.push({
        type: 'danger',
        code: 'BUDGET_EXCEEDED',
        message: `🚨 You have exceeded your monthly budget of ₹${budget.toLocaleString('en-IN')} by ₹${(summary.totalExpense - budget).toLocaleString('en-IN')}.`,
      });
    }

    res.status(200).json({
      success: true,
      data: { insights, summary },
    });
  } catch (error) {
    next(error);
  }
};

// ─── @route   GET /api/transactions/export ───────────────────────────────────
// ─── @access  Private
// Generates and returns a CSV string for the "Download Report" button in React
const exportCSV = async (req, res, next) => {
  try {
    // Fetch ALL transactions (no pagination) for the export
    const transactions = await Transaction.find({ user_id: req.user._id })
      .sort({ date: -1 })
      .lean();

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No transactions found to export.',
      });
    }

    // Build CSV header row
    const headers = ['Date', 'Title', 'Category', 'Type', 'Amount (₹)', 'Notes'];

    // Map each transaction document to a CSV row
    const rows = transactions.map((t) => {
      const date = new Date(t.date).toLocaleDateString('en-IN');
      // Wrap fields in quotes to handle commas in title/notes
      return [
        date,
        `"${t.title}"`,
        t.category,
        t.type,
        t.amount,
        `"${t.notes || ''}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    // Set response headers to trigger file download in the browser
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="expense_report_${Date.now()}.csv"`
    );

    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllTransactions,
  createTransaction,
  deleteTransaction,
  getSummary,
  getInsights,
  exportCSV,
};
