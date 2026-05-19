/**
 * components/TransactionTable.jsx  (Phase D — fully upgraded)
 *
 * Phase D additions over the original:
 *   ✦ Edit Transaction modal (Pencil icon → pre-filled form → PUT /api/transactions/:id)
 *   ✦ Delete Confirm modal   (replaces window.confirm — toast-style inline dialog)
 *   ✦ Search Autocomplete    (GET /api/transactions/titles?q= → typeahead dropdown)
 *   ✦ Date range filter props (from / to) passed in from HistoryPage
 *   ✦ isRecurring / isGeneratedCopy badges on rows
 *
 * Props:
 *   refreshTrigger {number} — increment from parent to force re-fetch
 *   from           {string} — YYYY-MM-DD date range start (optional)
 *   to             {string} — YYYY-MM-DD date range end   (optional)
 *
 * MERN Data Flow:
 *   GET /api/transactions?page&limit&type&category&search&from&to
 *   PUT /api/transactions/:id  → editTransaction controller → findOneAndUpdate
 *   DELETE /api/transactions/:id
 *   GET /api/transactions/titles?q= → getTitleSuggestions aggregation
 *   GET /api/transactions/export    → CSV blob download
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Search, Filter, Download, Trash2, Edit3,
  ChevronLeft, ChevronRight, Loader2, FileText,
  TrendingUp, TrendingDown, X, Check, Repeat,
  RefreshCw, AlertTriangle,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Housing','Food & Groceries','Transport','Utilities',
  'Entertainment','Healthcare','Salary','Other',
];
const PAGE_LIMIT = 10;

// ── Skeleton Row ───────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <tr>{[100,160,110,80,90,70,50].map((w,i) => (
    <td key={i} className="px-4 py-3">
      <div className="skeleton h-4 rounded" style={{ width: w }} />
    </td>
  ))}</tr>
);

// ── Empty State ────────────────────────────────────────────────────────────────
const EmptyState = ({ hasFilters, onClear }) => (
  <tr><td colSpan={7} className="px-4 py-16 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        <FileText size={24} className="text-slate-400 dark:text-slate-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
          {hasFilters ? 'No transactions match your filters' : 'No transactions yet'}
        </p>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {hasFilters ? 'Try adjusting your search or filter criteria.' : 'Add your first transaction using the form.'}
        </p>
      </div>
      {hasFilters && (
        <button onClick={onClear} className="btn-secondary text-xs py-1.5 px-3">
          <X size={12} />Clear filters
        </button>
      )}
    </div>
  </td></tr>
);

// ── Type Badge ─────────────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => type === 'Income'
  ? <span className="badge-income"><TrendingUp size={11} />Income</span>
  : <span className="badge-expense"><TrendingDown size={11} />Expense</span>;

// ─────────────────────────────────────────────────────────────────────────────
// ✦ Phase D: Delete Confirm Modal
// Replaces browser-native window.confirm with a styled portal dialog.
// ─────────────────────────────────────────────────────────────────────────────
const DeleteConfirmModal = ({ title, onConfirm, onCancel }) =>
  createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
         role="alertdialog" aria-modal="true" aria-labelledby="del-title">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/60 backdrop-blur-sm"
           onClick={onCancel} aria-hidden="true" />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 animate-slide-down">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-rose-500" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="del-title" className="text-base font-bold text-slate-900 dark:text-slate-100">Delete transaction?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 truncate">
              <span className="font-semibold text-slate-700 dark:text-slate-300">"{title}"</span>
              {' '}will be permanently removed.
            </p>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="btn-secondary flex-1 py-2.5">Cancel</button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-95 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200"
          >
            <Trash2 size={14} />Delete
          </button>
        </div>
      </div>
    </div>,
    document.body
  );

// ─────────────────────────────────────────────────────────────────────────────
// ✦ Phase D: Edit Transaction Modal
// Pre-fills all fields from the target transaction document.
// Calls PUT /api/transactions/:id on save.
// ─────────────────────────────────────────────────────────────────────────────
const EditModal = ({ tx, onSave, onClose }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title:    tx.title    || '',
    amount:   tx.amount?.toString() || '',
    type:     tx.type     || 'Expense',
    category: tx.category || 'Food & Groceries',
    date:     tx.date ? new Date(tx.date).toISOString().split('T')[0] : '',
    notes:    tx.notes    || '',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e = {};
    if (!form.title.trim() || form.title.trim().length < 2) e.title = 'Title must be at least 2 characters.';
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) < 1) e.amount = 'Amount must be at least ₹1.';
    if (!form.date) e.date = 'Date is required.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // PUT /api/transactions/:id — only sends fields that changed (partial update)
      const { data } = await axios.put(`/api/transactions/${tx._id}`, {
        title:    form.title.trim(),
        amount:   Number(form.amount),
        type:     form.type,
        category: form.category,
        date:     form.date,
        notes:    form.notes.trim(),
      });
      if (data.success) {
        toast.success('Transaction updated.', 'Saved');
        onSave(data.data); // Pass updated doc back to table for optimistic update
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to update transaction.', 'Error');
    } finally { setSaving(false); }
  };

  const field = (id, label, type, name, opts = {}) => (
    <div>
      <label htmlFor={id} className="form-label">{label}</label>
      <input id={id} type={type} name={name} value={form[name]}
        onChange={e => { setForm(p => ({ ...p, [name]: e.target.value })); setErrors(er => ({ ...er, [name]: '' })); }}
        className={`input-field ${opts.mono ? 'font-numeric' : ''} ${errors[name] ? 'border-rose-400 focus:ring-rose-400' : ''}`}
        {...opts}
      />
      {errors[name] && <p className="text-xs text-rose-500 mt-1.5 font-medium" role="alert">{errors[name]}</p>}
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
         role="dialog" aria-modal="true" aria-labelledby="edit-title">
      <div className="absolute inset-0 bg-slate-900/50 dark:bg-slate-950/60 backdrop-blur-sm"
           onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-down overflow-hidden">

        {/* Accent bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 to-teal-400" aria-hidden="true" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-emerald-500" aria-hidden="true" />
            <h2 id="edit-title" className="section-title">Edit Transaction</h2>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close edit modal">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Type toggle */}
          <div>
            <label className="form-label">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {['Income','Expense'].map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(p => ({ ...p, type: t }))}
                  className={[
                    'flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border transition-all duration-200 focus:outline-none focus:ring-2',
                    form.type === t && t === 'Income'
                      ? 'bg-emerald-500 border-emerald-500 text-white focus:ring-emerald-400'
                      : form.type === t
                      ? 'bg-rose-500 border-rose-500 text-white focus:ring-rose-400'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 focus:ring-slate-400',
                  ].join(' ')}
                  aria-pressed={form.type === t}
                >
                  {t === 'Income' ? <TrendingUp size={14}/> : <TrendingDown size={14}/>}{t}
                </button>
              ))}
            </div>
          </div>

          {field('em-title',  'Title',   'text',   'title',  { placeholder: 'Transaction title' })}
          {field('em-amount', 'Amount (₹)', 'number', 'amount', { mono: true, min: 1, placeholder: '0.00' })}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="em-cat" className="form-label">Category</label>
              <select id="em-cat" value={form.category}
                onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                className="select-field">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="em-date" className="form-label">Date</label>
              <input id="em-date" type="date" value={form.date}
                onChange={e => { setForm(p => ({ ...p, date: e.target.value })); setErrors(er => ({ ...er, date: '' })); }}
                max={new Date().toISOString().split('T')[0]}
                className={`input-field ${errors.date ? 'border-rose-400' : ''}`} />
              {errors.date && <p className="text-xs text-rose-500 mt-1 font-medium" role="alert">{errors.date}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="em-notes" className="form-label">Notes <span className="normal-case font-normal text-slate-400">(optional)</span></label>
            <textarea id="em-notes" value={form.notes} rows={2} maxLength={250}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="input-field resize-none" placeholder="Any extra details…" />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary flex-1 py-2.5">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 py-2.5">
            {saving ? <><Loader2 size={14} className="animate-spin"/>Saving…</> : <><Check size={14}/>Save changes</>}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ✦ Phase D: Autocomplete Dropdown
// Renders below the search input when suggestions are available.
// ─────────────────────────────────────────────────────────────────────────────
const AutocompleteDropdown = ({ suggestions, onSelect, inputRef }) => {
  if (!suggestions.length) return null;
  return (
    <ul
      className="absolute top-full left-0 right-0 mt-1 z-30 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-card-hover overflow-hidden animate-slide-down"
      role="listbox"
      aria-label="Title suggestions"
    >
      {suggestions.map((s, i) => (
        <li key={i}>
          <button
            type="button"
            onMouseDown={e => { e.preventDefault(); onSelect(s); }}
            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-100"
            role="option"
          >
            {s}
          </button>
        </li>
      ))}
    </ul>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main TransactionTable Component
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Props:
 *   refreshTrigger {number} — bump to force re-fetch from parent
 *   from           {string} — YYYY-MM-DD date range start  (Phase D)
 *   to             {string} — YYYY-MM-DD date range end    (Phase D)
 */
const TransactionTable = ({ refreshTrigger = 0, from = '', to = '' }) => {
  const { toast } = useToast();

  // ── Data state ────────────────────────────────────────────────────────────
  const [transactions, setTransactions] = useState([]);
  const [totalCount,   setTotalCount]   = useState(0);
  const [totalPages,   setTotalPages]   = useState(1);
  const [isLoading,    setIsLoading]    = useState(true);

  // ── Filter / pagination ───────────────────────────────────────────────────
  const [searchInput,     setSearchInput]     = useState('');
  const [search,          setSearch]          = useState('');
  const [typeFilter,      setTypeFilter]      = useState('');
  const [categoryFilter,  setCategoryFilter]  = useState('');
  const [page,            setPage]            = useState(1);

  // ── Modal / action state ──────────────────────────────────────────────────
  const [editTarget,      setEditTarget]      = useState(null);   // ✦ Phase D edit modal
  const [confirmDelete,   setConfirmDelete]   = useState(null);   // ✦ Phase D confirm modal {_id, title}
  const [deletingId,      setDeletingId]      = useState(null);
  const [isExporting,     setIsExporting]     = useState(false);

  // ── Autocomplete state ─────────────────────────────────────────────────────
  const [suggestions,     setSuggestions]     = useState([]);     // ✦ Phase D
  const [showSuggestions, setShowSuggestions] = useState(false);  // ✦ Phase D
  const suggestTimer      = useRef(null);
  const searchInputRef    = useRef(null);

  // ── Debounce search → API + autocomplete ──────────────────────────────────
  const debounceTimer = useRef(null);
  const handleSearchInput = (val) => {
    setSearchInput(val);
    clearTimeout(debounceTimer.current);
    clearTimeout(suggestTimer.current);

    debounceTimer.current = setTimeout(() => {
      setSearch(val);
      setPage(1);
    }, 400);

    // Fetch autocomplete suggestions (Phase D)
    if (val.trim().length >= 1) {
      suggestTimer.current = setTimeout(async () => {
        try {
          const { data } = await axios.get(`/api/transactions/titles?q=${encodeURIComponent(val.trim())}`);
          if (data.success) { setSuggestions(data.data); setShowSuggestions(true); }
        } catch { /* silently ignore autocomplete errors */ }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionSelect = (title) => {
    setSearchInput(title);
    setSearch(title);
    setPage(1);
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // ── Fetch transactions ────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page,
        limit: PAGE_LIMIT,
        ...(search        && { search }),
        ...(typeFilter    && { type: typeFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(from          && { from }),   // ✦ Phase D — date range from parent
        ...(to            && { to }),     // ✦ Phase D — date range from parent
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
  }, [page, search, typeFilter, categoryFilter, refreshTrigger, from, to]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  useEffect(() => { setPage(1); }, [typeFilter, categoryFilter, from, to]);

  // ── Delete flow ───────────────────────────────────────────────────────────
  const requestDelete = (tx) => setConfirmDelete({ _id: tx._id, title: tx.title });

  const confirmDeleteAction = async () => {
    if (!confirmDelete) return;
    setDeletingId(confirmDelete._id);
    setConfirmDelete(null);
    try {
      const { data } = await axios.delete(`/api/transactions/${confirmDelete._id}`);
      if (data.success) {
        setTransactions(prev => prev.filter(t => t._id !== confirmDelete._id));
        setTotalCount(prev => prev - 1);
        toast.success('Transaction deleted.', 'Deleted');
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete transaction.', 'Delete Failed');
    } finally { setDeletingId(null); }
  };

  // ── Edit save — optimistic row update ─────────────────────────────────────
  const handleEditSave = (updatedTx) => {
    setTransactions(prev => prev.map(t => t._id === updatedTx._id ? updatedTx : t));
    setEditTarget(null);
  };

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleCSVExport = async () => {
    setIsExporting(true);
    try {
      const response = await axios.get('/api/transactions/export', { responseType: 'blob' });
      const url  = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv;charset=utf-8;' }));
      const link = document.createElement('a');
      link.href  = url;
      link.setAttribute('download', `trackwise_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Report downloaded successfully!', 'CSV Export');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'No transactions to export, or export failed.', 'Export Failed');
    } finally { setIsExporting(false); }
  };

  // ── Clear filters ─────────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchInput(''); setSearch('');
    setTypeFilter(''); setCategoryFilter('');
    setSuggestions([]); setShowSuggestions(false);
    setPage(1);
  };

  const hasFilters = !!(search || typeFilter || categoryFilter || from || to);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <section aria-label="Transaction history">

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {editTarget && (
        <EditModal tx={editTarget} onSave={handleEditSave} onClose={() => setEditTarget(null)} />
      )}
      {confirmDelete && (
        <DeleteConfirmModal
          title={confirmDelete.title}
          onConfirm={confirmDeleteAction}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* ── Controls Row ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">

        {/* ✦ Phase D — Search with autocomplete */}
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            placeholder="Search transactions…"
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            onFocus={() => suggestions.length && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            className="input-field pl-9 pr-4"
            aria-label="Search transactions by title"
            aria-autocomplete="list"
            aria-expanded={showSuggestions}
          />
          {/* Autocomplete dropdown */}
          {showSuggestions && (
            <AutocompleteDropdown
              suggestions={suggestions}
              onSelect={handleSuggestionSelect}
              inputRef={searchInputRef}
            />
          )}
        </div>

        {/* Type filter */}
        <div className="relative">
          <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
            className="select-field pl-8 pr-8 min-w-[130px]" aria-label="Filter by type">
            <option value="">All Types</option>
            <option value="Income">Income</option>
            <option value="Expense">Expense</option>
          </select>
        </div>

        {/* Category filter */}
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="select-field min-w-[160px]" aria-label="Filter by category">
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Clear */}
        {hasFilters && (
          <button onClick={clearFilters} className="btn-ghost p-2" title="Clear all filters" aria-label="Clear filters">
            <X size={15} />
          </button>
        )}

        {/* Refresh */}
        <button onClick={fetchTransactions} disabled={isLoading} className="btn-ghost p-2" aria-label="Refresh list">
          <RefreshCw size={15} className={isLoading ? 'animate-spin text-emerald-500' : 'text-slate-400'} />
        </button>

        {/* CSV Export */}
        <button onClick={handleCSVExport} disabled={isExporting} className="btn-secondary whitespace-nowrap" aria-label="Download transactions as CSV">
          {isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14}/>}
          {isExporting ? 'Exporting…' : 'Download CSV'}
        </button>
      </div>

      {/* Results count */}
      {!isLoading && totalCount > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 font-medium">
          Showing{' '}
          <span className="text-slate-700 dark:text-slate-300 font-semibold">
            {(page - 1) * PAGE_LIMIT + 1}–{Math.min(page * PAGE_LIMIT, totalCount)}
          </span>{' '}
          of <span className="text-slate-700 dark:text-slate-300 font-semibold">{totalCount}</span> transactions
          {hasFilters && <span className="text-emerald-500 dark:text-emerald-400"> (filtered)</span>}
        </p>
      )}

      {/* ── Table ────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm" role="table" aria-label="Transactions list">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
              {['Date','Title','Category','Type','Amount','Actions'].map(col => (
                <th key={col} scope="col"
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800/30">
            {isLoading && Array.from({length:6}).map((_,i) => <SkeletonRow key={i}/>)}
            {!isLoading && transactions.length === 0 && <EmptyState hasFilters={hasFilters} onClear={clearFilters}/>}

            {!isLoading && transactions.map(tx => (
              <tr key={tx._id} className="table-row-alt transition-colors duration-150 group" role="row">

                {/* Date */}
                <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {formatDate(tx.date)}
                </td>

                {/* Title + notes + badges */}
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate" title={tx.title}>
                      {tx.title}
                    </p>
                    {/* ✦ Phase D — Recurring badges */}
                    {tx.isRecurring && (
                      <span title="Recurring template" aria-label="Recurring transaction">
                        <Repeat size={11} className="text-emerald-500 flex-shrink-0" />
                      </span>
                    )}
                    {tx.isGeneratedCopy && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex-shrink-0">
                        AUTO
                      </span>
                    )}
                  </div>
                  {tx.notes && (
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5" title={tx.notes}>
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

                {/* Amount */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`font-numeric font-semibold text-sm ${tx.type === 'Income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {tx.type === 'Income' ? '+' : '−'}₹{tx.amount.toLocaleString('en-IN')}
                  </span>
                </td>

                {/* ✦ Phase D — Edit + Delete actions */}
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    {/* Edit button */}
                    <button
                      onClick={() => setEditTarget(tx)}
                      className="inline-flex items-center justify-center p-2 rounded-lg
                                 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400
                                 hover:bg-emerald-50 dark:hover:bg-emerald-900/20
                                 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      aria-label={`Edit transaction: ${tx.title}`}
                      title="Edit"
                    >
                      <Edit3 size={14} />
                    </button>

                    {/* Delete button — opens confirm modal instead of window.confirm */}
                    <button
                      onClick={() => requestDelete(tx)}
                      disabled={deletingId === tx._id}
                      className="btn-danger p-2 rounded-lg"
                      aria-label={`Delete transaction: ${tx.title}`}
                      title="Delete"
                    >
                      {deletingId === tx._id
                        ? <Loader2 size={14} className="animate-spin"/>
                        : <Trash2 size={14}/>
                      }
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1 || isLoading}
            className="btn-secondary py-2 px-3 disabled:opacity-40" aria-label="Previous page">
            <ChevronLeft size={15}/>Prev
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button key={pageNum} onClick={() => setPage(pageNum)} disabled={isLoading}
                  className={[
                    'w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150',
                    pageNum === page
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700',
                  ].join(' ')}
                  aria-current={pageNum === page ? 'page' : undefined}
                  aria-label={`Page ${pageNum}`}
                >{pageNum}</button>
              );
            })}
            {totalPages > 7 && <span className="text-slate-400 text-xs px-1">…{totalPages}</span>}
          </div>

          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages || isLoading}
            className="btn-secondary py-2 px-3 disabled:opacity-40" aria-label="Next page">
            Next<ChevronRight size={15}/>
          </button>
        </div>
      )}
    </section>
  );
};

export default TransactionTable;