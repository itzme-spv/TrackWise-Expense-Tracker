/**
 * routes/transactions.js
 *
 * Transaction Routes
 * Mounted at: /api/transactions  (see server.js)
 *
 * ALL routes require JWT authentication via the `protect` middleware.
 *
 * Endpoint map:
 *   GET    /api/transactions           → Get all transactions (paginated, filtered)
 *   POST   /api/transactions           → Create a new transaction
 *   DELETE /api/transactions/:id       → Delete a specific transaction
 *   GET    /api/transactions/summary   → Get Income/Expense/Balance totals + chart data
 *   GET    /api/transactions/insights  → Get smart spending insight alerts
 *   GET    /api/transactions/export    → Download all transactions as CSV
 *
 * Route ordering note:
 *   /summary, /insights, and /export MUST be defined BEFORE /:id
 *   to prevent Express from interpreting "summary" as an ObjectId.
 */

const express = require('express');
const { body } = require('express-validator');

const {
  getAllTransactions,
  createTransaction,
  deleteTransaction,
  getSummary,
  getInsights,
  exportCSV,
} = require('../controllers/transactionController');

const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// ─── Apply protect to ALL routes in this router ───────────────────────────────
// This is cleaner than adding `protect` to every individual route.
router.use(protect);

// ─── Validation Rules for Creating a Transaction ─────────────────────────────
const transactionValidation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Transaction title is required.')
    .isLength({ min: 2 }).withMessage('Title must be at least 2 characters.')
    .isLength({ max: 100 }).withMessage('Title cannot exceed 100 characters.'),

  body('amount')
    .notEmpty().withMessage('Amount is required.')
    .isNumeric().withMessage('Amount must be a number.')
    .isFloat({ min: 1 }).withMessage('Amount must be at least ₹1.'),

  body('type')
    .notEmpty().withMessage('Type is required.')
    .isIn(['Income', 'Expense']).withMessage('Type must be "Income" or "Expense".'),

  body('category')
    .notEmpty().withMessage('Category is required.')
    .isIn([
      'Housing',
      'Food & Groceries',
      'Transport',
      'Utilities',
      'Entertainment',
      'Healthcare',
      'Salary',
      'Other',
    ])
    .withMessage('Invalid category selected.'),

  body('date')
    .optional()
    .isISO8601().withMessage('Date must be a valid ISO 8601 date string.'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 250 }).withMessage('Notes cannot exceed 250 characters.'),
];

// ─── Route Definitions ────────────────────────────────────────────────────────

// @route   GET /api/transactions/summary
// @desc    Aggregated Income, Expense, Balance, Category Breakdown for Dashboard
// @access  Private
// ⚠️ MUST be before /:id — otherwise "summary" is matched as an ObjectId param
router.get('/summary', getSummary);

// @route   GET /api/transactions/insights
// @desc    Smart spending alert data (banner logic)
// @access  Private
router.get('/insights', getInsights);

// @route   GET /api/transactions/export
// @desc    Download all transactions as a CSV file
// @access  Private
router.get('/export', exportCSV);

// @route   GET /api/transactions
// @desc    Get all transactions for the current user with optional filters & pagination
//          Query params: ?page=1&limit=10&type=Expense&category=Food&search=coffee
// @access  Private
router.get('/', getAllTransactions);

// @route   POST /api/transactions
// @desc    Create a new transaction
// @access  Private
router.post('/', transactionValidation, createTransaction);

// @route   DELETE /api/transactions/:id
// @desc    Delete a transaction by its MongoDB ObjectId
// @access  Private
router.delete('/:id', deleteTransaction);

module.exports = router;
