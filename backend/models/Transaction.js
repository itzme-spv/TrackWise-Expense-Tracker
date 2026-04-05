/**
 * models/Transaction.js
 *
 * Mongoose Schema for the Transaction entity.
 *
 * MERN Data Flow note:
 *   React's TransactionForm POSTs to /api/transactions.
 *   The TransactionController creates a new Transaction document
 *   linked to the authenticated user via `user_id` (populated from JWT).
 *   The saved document is returned as JSON, and React updates its
 *   local state — no full page reload required.
 */

const mongoose = require('mongoose');

// ─── Allowed Enum Values ──────────────────────────────────────────────────────
// Centralising enums here keeps validation DRY across schema and controllers.
const TRANSACTION_TYPES = ['Income', 'Expense'];

const TRANSACTION_CATEGORIES = [
  'Housing',
  'Food & Groceries',
  'Transport',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Salary',
  'Other',
];

// ─── Schema Definition ────────────────────────────────────────────────────────
const TransactionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Transaction title is required.'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters.'],
      maxlength: [100, 'Title cannot exceed 100 characters.'],
    },

    amount: {
      type: Number,
      required: [true, 'Amount is required.'],
      min: [1, 'Amount must be at least ₹1.'],
    },

    type: {
      type: String,
      required: [true, 'Transaction type is required.'],
      enum: {
        values: TRANSACTION_TYPES,
        message: `Type must be one of: ${TRANSACTION_TYPES.join(', ')}.`,
      },
    },

    category: {
      type: String,
      required: [true, 'Category is required.'],
      enum: {
        values: TRANSACTION_CATEGORIES,
        message: `Category must be one of: ${TRANSACTION_CATEGORIES.join(', ')}.`,
      },
    },

    date: {
      type: Date,
      default: Date.now, // Auto-populate if the frontend doesn't send a date
    },

    // Foreign key — links every transaction to exactly one User
    // Populated from the JWT payload in the protect middleware (see authMiddleware.js)
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',          // Enables Mongoose's .populate('user_id') if needed
      required: [true, 'Transaction must belong to a user.'],
      index: true,          // Index for fast per-user queries
    },

    // Optional note/description for the transaction
    notes: {
      type: String,
      trim: true,
      maxlength: [250, 'Notes cannot exceed 250 characters.'],
      default: '',
    },
  },
  {
    timestamps: true, // Adds createdAt / updatedAt
  }
);

// ─── Compound Index ───────────────────────────────────────────────────────────
// Optimises common query: "fetch all transactions for user X, sorted by date desc"
TransactionSchema.index({ user_id: 1, date: -1 });

// ─── Virtual: formattedAmount ─────────────────────────────────────────────────
/**
 * Returns the amount prefixed with ₹ and formatted to 2 decimal places.
 * Virtuals are NOT stored in MongoDB — they are computed on the fly.
 * Include in JSON output by enabling { virtuals: true } in toJSON options below.
 */
TransactionSchema.virtual('formattedAmount').get(function () {
  return `₹${this.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
});

// Make virtuals available when converting documents to JSON (for API responses)
TransactionSchema.set('toJSON', { virtuals: true });
TransactionSchema.set('toObject', { virtuals: true });

// ─── Static Method: Summary Aggregation ──────────────────────────────────────
/**
 * Transaction.getSummaryForUser(userId)
 *
 * Uses MongoDB's Aggregation Pipeline to calculate total Income and
 * total Expense for a given user — much more efficient than fetching
 * all documents into Node.js memory and summing in JS.
 *
 * @param {ObjectId} userId
 * @returns {Promise<{ totalIncome: number, totalExpense: number, balance: number }>}
 */
TransactionSchema.statics.getSummaryForUser = async function (userId) {
  const result = await this.aggregate([
    // Stage 1: Filter documents belonging to this user only
    { $match: { user_id: new mongoose.Types.ObjectId(userId) } },

    // Stage 2: Group by `type` and sum amounts
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
      },
    },
  ]);

  // Transform aggregation result array into a clean object
  const summary = { totalIncome: 0, totalExpense: 0 };
  result.forEach((item) => {
    if (item._id === 'Income') summary.totalIncome = item.total;
    if (item._id === 'Expense') summary.totalExpense = item.total;
  });
  summary.balance = summary.totalIncome - summary.totalExpense;

  return summary;
};

/**
 * Transaction.getCategoryBreakdownForUser(userId)
 *
 * Aggregates expense amounts grouped by category for the Pie/Doughnut chart.
 *
 * @param {ObjectId} userId
 * @returns {Promise<Array<{ category: string, total: number }>>}
 */
TransactionSchema.statics.getCategoryBreakdownForUser = async function (userId) {
  return this.aggregate([
    {
      $match: {
        user_id: new mongoose.Types.ObjectId(userId),
        type: 'Expense', // Only expenses go into the category breakdown chart
      },
    },
    {
      $group: {
        _id: '$category',
        total: { $sum: '$amount' },
      },
    },
    {
      $project: {
        _id: 0,
        category: '$_id',
        total: 1,
      },
    },
    { $sort: { total: -1 } }, // Largest category first
  ]);
};

// ─── Export Model & Enums ─────────────────────────────────────────────────────
const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
module.exports.TRANSACTION_TYPES = TRANSACTION_TYPES;
module.exports.TRANSACTION_CATEGORIES = TRANSACTION_CATEGORIES;
