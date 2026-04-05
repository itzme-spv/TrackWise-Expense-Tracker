/**
 * components/TransactionTable.jsx
 *
 * Transaction History Table Component
 *
 * Features:
 *   - Paginated transaction list (Next / Prev controls)
 *   - Search by title (debounced — waits 400ms after keystroke to avoid hammering the API)
 *   - Filter by Type (Income / Expense) and Category (dropdown)
 *   - Alternating row colours via .table-row-alt CSS class from index.css
 *   - Row hover effects with transition
 *   - Delete action per row (calls DELETE /api/transactions/:id)
 *   - 1-Click CSV Download (hits GET /api/transactions/export, triggers browser save)
 *   - Responsive: table scrolls horizontally on mobile
 *
 * MERN Data Flow:
 *   GET /api/transactions?page=1&limit=10&type=Expense&category=Food&search=coffee
 *   → Express controller → Mongoose .find().skip().limit() → JSON response
 *   → React state → render rows
 *
 *   DELETE /api/transactions/:id → Express controller → Mongoose.findOneAndDelete
 *   → 200 OK → React removes row from state optimistically
 *
 *   GET /api/transactions/export → Express → CSV string → blob URL → auto-download
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  Search,
  Filter,
  Download,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
  TrendingUp,
  TrendingDown,
  X,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Housing', 'Food & Groceries', 'Transport', 'Utilities',
  'Entertainment', 'Healthcare', 'Salary', 'Other',
];

const PAGE_LIMIT = 10;

// ── Skeleton Row ───────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr>
    {[120, 160, 100, 80, 90, 50].map((w, i) => (
      <td key={i} className="px-4 py-3">
        <div className="skeleton h-4 rounded" style={{ width: `${w}px` }} />
      </td>
    ))}
  </tr>
);

// ── Empty State ────────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear }) => (
  <tr>
    <td colSpan={6} className="px-4 py-16 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
          <FileText size={24} className="text-slate-400 dark:text-slate-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
            {hasFilters ? 'No transactions match your filters' : 'No transactions yet'}
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {hasFilters
              ? 'Try adjusting your search or filter criteria.'
              : 'Add your first transaction using the form above.'}
          </p>
        </div>
        {hasFilters && (
          <button onClick={onClear} className="btn-secondary text-xs py-1.5 px-3">
            <X size={12} />
            Clear filters
          </button>
        )}
      </div>
    </td>
  </tr>
);

// ── Type Badge ─────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) =>
  type === 'Income' ? (
    <span className="badge-income">
      <TrendingUp size={11} />
      Income
    </span>
  ) : (
    <span className="badge-expense">
      <TrendingDown size={11} />
      Expense
    </span>
  );

// ── Main TransactionTable Component ───────────────────────────────────────────
/**
 * Props:
 *   refreshTrigger {number} — Increment this from the parent to force a re-fetch
 *                             (used after a new transaction is added via the form)
 */
const TransactionTable = ({ refreshTrigger = 0 }) => {
  // ── Data state ───────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // ── Filter/pagination state ───────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');   // Raw typed value
  const [search, setSearch] = useState('');             // Debounced value sent to API
  const [typeFilter, setTypeFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  // ── Delete state ──────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState(null);

  // ── CSV export state ──────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);

  // ── Debounce search input ─────────────────────────────────────────────────
  const debounceTimer = useRef(null);
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1); // Reset to page 1 on new search
    }, 400);
  };

  // ── Fetch transactions ────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: PAGE_LIMIT,
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
      });

      const { data } = await axios.get(`/api/transactions?${params.toString()}`);

      if (data.success) {
        setTransactions(data.data);
        setTotalCount(data.totalCount);
        setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, search, typeFilter, categoryFilter, refreshTrigger]);

  // Re-fetch whenever dependencies change (incl. refreshTrigger from parent)
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, categoryFilter]);

  // ── Delete handler ────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this transaction? This cannot be undone.')) return;

    setDeletingId(id);
    try {
      const { data } = await axios.delete(`/api/transactions/${id}`);
      if (data.success) {
        // Optimistically remove from local state
        setTransactions((prev) => prev.filter((t) => t._id !== id));
        setTotalCount((prev) => prev - 1);
      }
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete transaction. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  /**
   * Calls GET /api/transactions/export which returns a CSV string.
   * We create a Blob URL and programmatically click a hidden <a> tag
   * to trigger the browser's native "Save File" dialogue.
   *
   * MERN Data Flow:
   *   axios.get('/api/transactions/export') → Express res.send(csvString)
   *   → Blob → URL.createObjectURL → anchor.click() → browser download
   */
  const handleCSVExport = async () => {
    setIsExporting(true);
    try {
      const response = await axios.get('/api/transactions/export', {
        responseType: 'blob', // Critical: tells Axios to receive binary data
      });

      // Create a temporary in-memory URL for the Blob
      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: 'text/csv;charset=utf-8;' })
      );

      // Programmatically click an invisible anchor to trigger download
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `trackwise_report_${new Date().toISOString().split('T')[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();

      // Clean up the temporary URL and DOM element
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('CSV export failed:', err);
      alert('No transactions to export, or export failed.');
    } finally {
      setIsExporting(false);
    }
  };

  // ── Clear all filters ─────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setTypeFilter('');
    setCategoryFilter('');
    setPage(1);
  };

  const hasFilters = !!(search || typeFilter || categoryFilter);

  // ── Format date for display ───────────────────────────────────────────────
  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // <section> for the entire table area — semantic HTML5
    <section aria-label="Transaction history">

      {/* ── Controls Row: Search + Filters + Export ──────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">

        {/* Search bar */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search transactions…"
            value={searchInput}
            onChange={(e) => handleSearchInput(e.target.value)}
            className="input-field pl-9 pr-4"
            aria-label="Search transactions by title"
          />
        </div>

        {/* Type filter */}
        <div className="relative">
          <Filter
            size={13}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="select-field pl-8 pr-8 min-w-[130px]"
            aria-label="Filter by type"
          >
            <option value="">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="select-field min-w-[160px]"
          aria-label="Filter by category"
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        {/* Clear filters button — only shows when filters are active */}
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost p-2" title="Clear all filters" aria-label="Clear filters">
            <X size={15} />
          </button>
        )}

        {/* CSV Export */}
        <button
          onClick={handleCSVExport}
          disabled={isExporting}
          className="btn-secondary whitespace-nowrap"
          aria-label="Download transactions as CSV"
        >
          {isExporting ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Download size={14} />
          )}
          {isExporting ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      {/* ── Results count ─────────────────────────────────────────────── */}
      {!isLoading && totalCount > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 font-medium">
          Showing{' '}
          <span className="text-slate-700 dark:text-slate-300 font-semibold">
            {(page - 1) * PAGE_LIMIT + 1}–
            {Math.min(page * PAGE_LIMIT, totalCount)}
          </span>{' '}
          of{' '}
          <span className="text-slate-700 dark:text-slate-300 font-semibold">
            {totalCount}
          </span>{' '}
          transactions
          {hasFilters && (
            <span className="text-emerald-500 dark:text-emerald-400"> (filtered)</span>
          )}
        </p>
      )}

      {/* ── Table — horizontally scrollable on mobile ──────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm" role="table" aria-label="Transactions list">
          {/* Table header */}
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              {['Date', 'Title', 'Category', 'Type', 'Amount', 'Action'].map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800/30">
            {/* Loading skeleton rows */}
            {isLoading &&
              Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
            }

            {/* Empty state */}
            {!isLoading && transactions.length === 0 && (
              <EmptyState hasFilters={hasFilters} onClear={clearFilters} />
            )}

            {/* Transaction rows */}
            {!isLoading &&
              transactions.map((tx) => (
                <tr
                  key={tx._id}
                  // .table-row-alt from index.css: even rows bg-slate-50, hover bg-slate-100
                  className="table-row-alt transition-colors duration-150"
                  role="row"
                >
                  {/* Date */}
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {formatDate(tx.date)}
                  </td>

                  {/* Title + optional notes tooltip */}
                  <td className="px-4 py-3 max-w-[200px]">
                    <p
                      className="font-semibold text-slate-800 dark:text-slate-200 truncate"
                      title={tx.title}
                    >
                      {tx.title}
                    </p>
                    {tx.notes && (
                      <p
                        className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5"
                        title={tx.notes}
                      >
                        {tx.notes}
                      </p>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                    {tx.category}
                  </td>

                  {/* Type badge */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <TypeBadge type={tx.type} />
                  </td>

                  {/* Amount — colour-coded and monospaced */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`font-numeric font-semibold text-sm ${
                        tx.type === 'Income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {tx.type === 'Income' ? '+' : '−'}₹
                      {tx.amount.toLocaleString('en-IN')}
                    </span>
                  </td>

                  {/* Delete action */}
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDelete(tx._id)}
                      disabled={deletingId === tx._id}
                      className="btn-danger p-2 rounded-lg"
                      aria-label={`Delete transaction: ${tx.title}`}
                      title="Delete"
                    >
                      {deletingId === tx._id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination Controls ────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          {/* Prev */}
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="btn-secondary py-2 px-3 disabled:opacity-40"
            aria-label="Previous page"
          >
            <ChevronLeft size={15} />
            Prev
          </button>

          {/* Page indicator + dots */}
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              // Show first, last, current ± 1, and ellipses
              const pageNum = i + 1;
              const isCurrent = pageNum === page;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  disabled={isLoading}
                  className={[
                    'w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150',
                    isCurrent
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                  ].join(' ')}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-label={`Page ${pageNum}`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 7 && (
              <span className="text-slate-400 text-xs px-1">…{totalPages}</span>
            )}
          </div>

          {/* Next */}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
            className="btn-secondary py-2 px-3 disabled:opacity-40"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </section>
  );
};

export default TransactionTable;
