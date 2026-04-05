/**
 * pages/HistoryPage.jsx
 *
 * Transaction History Page
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │  Page header + period summary strip          │
 *   ├──────────────────────────────────────────────┤
 *   │  TransactionTable (search, filter, export,   │
 *   │  paginated rows, delete, alternating colours)│
 *   └──────────────────────────────────────────────┘
 *
 * Additionally renders:
 *   - 3 mini stat pills at the top: total transactions, income sum, expense sum
 *   - A "Quick Add" slide-out panel so users can add transactions from History too
 *
 * MERN Data Flow:
 *   TransactionTable internally calls:
 *     GET /api/transactions?page=&limit=&type=&category=&search=
 *   This page also fetches:
 *     GET /api/transactions/summary → for the top stat pills
 *
 *   When the slide-out form saves a new transaction, `refreshKey` increments,
 *   causing TransactionTable to re-fetch its data — no page reload.
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  History,
  TrendingUp,
  TrendingDown,
  Activity,
  PlusCircle,
  X,
  ChevronRight,
} from 'lucide-react';

import TransactionTable from '../components/TransactionTable';
import TransactionForm from '../components/TransactionForm';

// ── Mini Stat Pill ──────────────────────────────────────────────────────────────
/**
 * A compact summary stat shown in the top strip of the History page.
 * Smaller and more subtle than the Dashboard's full StatCard.
 */
const StatPill = ({ label, value, icon: Icon, colorClass, isLoading }) => (
  <div className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-card flex-1 min-w-0">
    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
      <Icon size={15} aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
        {label}
      </p>
      {isLoading ? (
        <div className="skeleton h-5 w-20 mt-0.5 rounded" />
      ) : (
        <p className="font-numeric text-sm font-bold text-slate-800 dark:text-slate-100 truncate">
          {value}
        </p>
      )}
    </div>
  </div>
);

// ── Quick-Add Slide Panel ──────────────────────────────────────────────────────
/**
 * A slide-in side panel containing the TransactionForm.
 * Lets users add transactions without navigating away from History.
 */
const QuickAddPanel = ({ isOpen, onClose, onSuccess }) => (
  <>
    {/* Backdrop overlay */}
    {isOpen && (
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-slate-900/60 backdrop-blur-sm z-40 transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />
    )}

    {/* Slide-in panel */}
    <aside
      className={[
        'fixed top-0 right-0 h-full w-full max-w-sm z-50',
        'bg-white dark:bg-slate-800 shadow-2xl border-l border-slate-200 dark:border-slate-700',
        'flex flex-col',
        'transition-transform duration-300 ease-in-out',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      ].join(' ')}
      aria-label="Quick add transaction panel"
      role="complementary"
    >
      {/* Panel header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-2">
          <PlusCircle size={18} className="text-emerald-500" aria-hidden="true" />
          <h2 className="section-title">Add Transaction</h2>
        </div>
        <button
          onClick={onClose}
          className="btn-ghost p-2"
          aria-label="Close panel"
        >
          <X size={18} />
        </button>
      </header>

      {/* Scrollable form area */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <TransactionForm
          onSuccess={(tx) => {
            onSuccess(tx);
            onClose();
          }}
        />
      </div>

      {/* Panel footer */}
      <footer className="px-6 py-4 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
        <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
          Transaction will appear in the table immediately.
        </p>
      </footer>
    </aside>
  </>
);

// ── Main HistoryPage ───────────────────────────────────────────────────────────
const HistoryPage = () => {
  // ── Summary stats for top strip ────────────────────────────────────────────
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // ── Table refresh trigger — increment after adding a transaction ────────────
  // Passed as `refreshTrigger` prop to TransactionTable
  const [refreshKey, setRefreshKey] = useState(0);

  // ── Quick-add panel open state ─────────────────────────────────────────────
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // ── Fetch summary on mount + after every transaction add ───────────────────
  useEffect(() => {
    const fetchSummary = async () => {
      setSummaryLoading(true);
      try {
        const { data } = await axios.get('/api/transactions/summary');
        if (data.success) setSummary(data.data);
      } catch (err) {
        console.error('History page summary fetch failed:', err);
      } finally {
        setSummaryLoading(false);
      }
    };
    fetchSummary();
  }, [refreshKey]); // Re-fetch whenever a transaction is added/deleted

  // ── After form saves successfully ─────────────────────────────────────────
  const handleTransactionSuccess = () => {
    setRefreshKey((prev) => prev + 1); // Triggers TransactionTable re-fetch + summary re-fetch
  };

  // ── Format stat values ────────────────────────────────────────────────────
  const formatRupee = (val) =>
    `₹${(val ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;

  return (
    <>
      {/* Quick-add slide panel */}
      <QuickAddPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        onSuccess={handleTransactionSuccess}
      />

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Section icon badge */}
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shadow-md flex-shrink-0">
            <History size={18} className="text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Transaction History
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Search, filter, and export all your transactions.
            </p>
          </div>
        </div>

        {/* Add Transaction button — opens the side panel */}
        <button
          onClick={() => setIsPanelOpen(true)}
          className="btn-primary flex-shrink-0 self-start sm:self-auto"
          aria-expanded={isPanelOpen}
          aria-controls="quick-add-panel"
        >
          <PlusCircle size={16} />
          Add Transaction
          <ChevronRight size={14} className="opacity-70" />
        </button>
      </header>

      {/* ── Summary Strip: 3 mini stat pills ─────────────────────────── */}
      <section
        aria-label="Period summary"
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6"
      >
        <StatPill
          label="Total Transactions"
          value={summary ? `${(summary.totalIncome > 0 || summary.totalExpense > 0) ? '–' : '0'}` : '–'}
          icon={Activity}
          colorClass="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
          isLoading={summaryLoading}
        />
        <StatPill
          label="Total Income"
          value={formatRupee(summary?.totalIncome)}
          icon={TrendingUp}
          colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
          isLoading={summaryLoading}
        />
        <StatPill
          label="Total Expenses"
          value={formatRupee(summary?.totalExpense)}
          icon={TrendingDown}
          colorClass="bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
          isLoading={summaryLoading}
        />
      </section>

      {/* ── Transaction Table ─────────────────────────────────────────── */}
      {/*
        .page-section from index.css:
          bg-white dark:bg-slate-800, rounded-2xl, border, shadow-card, p-6
      */}
      <section className="page-section" aria-label="Transaction list">
        {/*
          TransactionTable handles its own fetching internally.
          `refreshTrigger` tells it to re-fetch when a transaction is added here.
          TransactionTable's own delete action updates its internal state optimistically,
          then we also bump refreshKey so the summary strip stays in sync.
        */}
        <TransactionTable
          refreshTrigger={refreshKey}
        />
      </section>

      {/* ── Tip footer ────────────────────────────────────────────────── */}
      <footer className="mt-6 flex items-start gap-3 px-1">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-2 flex-shrink-0" aria-hidden="true" />
        <p className="text-xs text-slate-400 dark:text-slate-500 leading-relaxed">
          <strong className="text-slate-500 dark:text-slate-400 font-semibold">Tip:</strong>{' '}
          Use the <span className="font-semibold text-slate-600 dark:text-slate-300">Download CSV</span> button
          to export all your transactions for use in Excel or Google Sheets.
          Filters are applied before export.
        </p>
      </footer>
    </>
  );
};

export default HistoryPage;
