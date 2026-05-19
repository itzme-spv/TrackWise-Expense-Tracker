/**
 * components/TransactionForm.jsx
 *
 * Quick-Add Transaction Form — with 🎤 Voice Dictation
 *
 * Features:
 *   - Controlled form inputs with client-side HTML5 + JS validation
 *   - Web Speech API (window.SpeechRecognition) for voice dictation of
 *     the `title` and `notes` fields
 *   - Graceful degradation — microphone button is hidden if the browser
 *     doesn't support the Speech Recognition API
 *   - Category and Type dropdowns matching the backend Mongoose enums
 *   - Optimistic UI: calls `onSuccess(newTransaction)` so DashboardPage
 *     can update summary state immediately without a page reload
 *
 * MERN Data Flow:
 *   Form submit → axios.post('/api/transactions', payload) → Express controller
 *   → Mongoose Transaction.create() → returns saved doc → onSuccess(doc)
 *   → DashboardPage re-fetches summary to update all stat cards & chart
 *
 * Voice Dictation Flow:
 *   Mic button click → SpeechRecognition.start() → user speaks
 *   → onresult event → transcript set as field value → recognition.stop()
 */

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { useToast } from '../context/ToastContext'; // Phase B
import{
  Mic,
  MicOff,
  PlusCircle,
  Loader2,
  DollarSign,
  Tag,
  AlignLeft,
  Calendar,
  LayoutGrid,
  ArrowUpCircle,
  ArrowDownCircle,
  CheckCircle2,
  Repeat
} from 'lucide-react';

// ── Constants matching backend Transaction model enums ─────────────────────────
const CATEGORIES = [
  'Housing',
  'Food & Groceries',
  'Transport',
  'Utilities',
  'Entertainment',
  'Healthcare',
  'Salary',
  'Other',
];

const RECURRING_FREQUENCIES = ['Daily', 'Weekly', 'Monthly'];

const INITIAL_FORM = {
  title: '',
  amount: '',
  type: 'Expense',
  category: 'Food & Groceries',
  date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD
  notes: '',
  isRecurring: false,          // Phase D — recurring transaction template
  recurringFrequency: 'Monthly', // Phase D — Daily | Weekly | Monthly
};

// ── Mic Button Sub-Component ───────────────────────────────────────────────────
/**
 * Renders an animated microphone button.
 * Shows a pulsing red ring while actively recording.
 *
 * Props:
 *   isListening {boolean}  — Is the recogniser currently active?
 *   onClick     {function} — Toggle start/stop recognition
 *   targetField {string}   — Which field is being dictated ('title' | 'notes')
 */
const MicButton = ({ isListening, onClick, targetField, activeField }) => {
  const isActiveForThisField = isListening && activeField === targetField;

  return (
    <button
      type="button"
      onClick={onClick}
      title={isActiveForThisField ? 'Stop dictation' : `Dictate ${targetField}`}
      aria-label={isActiveForThisField ? 'Stop voice dictation' : `Start voice dictation for ${targetField}`}
      className={[
        'relative flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center',
        'transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1',
        isActiveForThisField
          ? 'bg-rose-500 text-white focus:ring-rose-400 shadow-lg scale-105'
          : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 focus:ring-slate-400',
      ].join(' ')}
    >
      {/* Pulsing ring animation while listening */}
      {isActiveForThisField && (
        <span className="absolute inset-0 rounded-lg bg-rose-400 animate-ping opacity-30" />
      )}
      {isActiveForThisField ? (
        <MicOff size={15} className="relative z-10" />
      ) : (
        <Mic size={15} className="relative z-10" />
      )}
    </button>
  );
};

// ── Field Error Message ────────────────────────────────────────────────────────
const FieldError = ({ message }) =>
  message ? (
    <p className="text-xs text-rose-500 mt-1 font-medium" role="alert">
      {message}
    </p>
  ) : null;

// ── Success Toast ──────────────────────────────────────────────────────────────
const SuccessToast = ({ show }) =>
  show ? (
    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm font-semibold animate-slide-down">
      <CheckCircle2 size={16} />
      Transaction added!
    </div>
  ) : null;

// ── Main TransactionForm Component ─────────────────────────────────────────────
/**
 * Props:
 *   onSuccess {function(newTransaction)} — Called after successful API save
 */
const TransactionForm = ({ onSuccess }) => {
  // Phase B — toast replaces inline API error banner for submission errors
  const { toast } = useToast();
  // ── Form state ───────────────────────────────────────────────────────────
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Phase B: API errors fire as toasts — no longer stored in local state
  const [micError, setMicError] = useState(''); // kept only for mic permission denials
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Voice Dictation state ────────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [activeField, setActiveField] = useState(null); // 'title' | 'notes'
  const [speechSupported, setSpeechSupported] = useState(false);
  const recognitionRef = useRef(null);

  // ── Check Web Speech API support on mount ────────────────────────────────
  useEffect(() => {
    // The Speech Recognition API is vendor-prefixed in some browsers
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);

      // Initialise the recogniser once and reuse it
      const recognition = new SpeechRecognition();
      recognition.continuous = false;    // Stop after first natural pause
      recognition.interimResults = false; // We only need the final transcript
      recognition.lang = 'en-IN';        // Indian English — matches ₹ context

      // ── onresult: transcript received ─────────────────────────────────
      recognition.onresult = (event) => {
        // Get the most confident transcript from the first result
        const transcript = Array.from(event.results)
          .map((result) => result[0].transcript)
          .join(' ')
          .trim();

        // Inject transcript into whichever field triggered dictation
        setForm((prev) => ({
          ...prev,
          [activeField]: transcript,
        }));

        // Clear any existing error for this field
        setErrors((prev) => ({ ...prev, [activeField]: '' }));
      };

      // ── onend: recognition stopped (naturally or via .stop()) ─────────
      recognition.onend = () => {
        setIsListening(false);
        setActiveField(null);
      };

      // ── onerror: microphone permission denied, etc. ────────────────────
      recognition.onerror = (event) => {
        console.error('SpeechRecognition error:', event.error);
        setIsListening(false);
        setActiveField(null);

        if (event.error === 'not-allowed') {
          toast.error('Microphone access denied. Please allow microphone permission in your browser.', 'Mic Error');
        }
      };

      recognitionRef.current = recognition;
    }

    // Cleanup: stop recognition if the component unmounts while recording
    return () => {
      recognitionRef.current?.abort();
    };
  }, []); // Run once on mount

  // ── activeField ref for onresult closure ─────────────────────────────────
  // We store activeField in a ref so the SpeechRecognition event handler
  // always reads the current value (closures capture stale state).
  const activeFieldRef = useRef(activeField);
  useEffect(() => {
    activeFieldRef.current = activeField;
  }, [activeField]);

  // Patch onresult to use the ref
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim();

      const field = activeFieldRef.current;
      if (field) {
        setForm((prev) => ({ ...prev, [field]: transcript }));
        setErrors((prev) => ({ ...prev, [field]: '' }));
      }
    };
  }, []); // Only once — reads activeFieldRef.current dynamically

  // ── Toggle Dictation for a specific field ────────────────────────────────
  const toggleDictation = (fieldName) => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isListening) {
      // If already listening, stop regardless of which field
      recognition.stop();
      setIsListening(false);
      setActiveField(null);
    } else {
      // Start dictation for the requested field
      setActiveField(fieldName);
      setIsListening(true);
      //setApiError('');

      try {
        recognition.start();
      } catch (e) {
        // Catch "recognition already started" edge case
        console.warn('Recognition start error:', e);
        setIsListening(false);
        setActiveField(null);
      }
    }
  };

  // ── Field change handler ─────────────────────────────────────────────────
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!form.title.trim()) {
      newErrors.title = 'Title is required.';
    } else if (form.title.trim().length < 2) {
      newErrors.title = 'Title must be at least 2 characters.';
    }

    if (!form.amount) {
      newErrors.amount = 'Amount is required.';
    } else if (isNaN(Number(form.amount)) || Number(form.amount) < 1) {
      newErrors.amount = 'Amount must be at least ₹1.';
    }

    if (!form.category) {
      newErrors.category = 'Please select a category.';
    }

    if (!form.date) {
      newErrors.date = 'Date is required.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Form submission ────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Stop dictation if active when user submits
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    }

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      // POST to /api/transactions — Axios Authorization header is set globally in AuthContext
      const { data } = await axios.post('/api/transactions', {
        title:              form.title.trim(),
        amount:             Number(form.amount),
        type:               form.type,
        category:           form.category,
        date:               form.date,
        notes:              form.notes.trim(),
        isRecurring:        form.isRecurring,              // Phase D
        recurringFrequency: form.isRecurring               // Phase D
          ? form.recurringFrequency
          : undefined,
      });

      if (data.success) {
        // Notify parent so it can refresh the summary data
        onSuccess?.(data.data);

        // Show inline success confirmation
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);

        // Reset form to initial state
        setForm(INITIAL_FORM);
        setErrors({});
      }
    } catch (err) {
      // Phase B — toast replaces inline API error banner
      toast.error(
        err?.response?.data?.message || 'Failed to save transaction. Please try again.',
        'Save Failed'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // <article> for a self-contained interactive widget per HTML5 spec
    <article aria-label="Add new transaction form">
      <form onSubmit={handleSubmit} noValidate className="space-y-4">

        {/* ── Type Toggle: Income / Expense ─────────────────────────────── */}
        <div>
          <label className="form-label">Type</label>
          <div className="grid grid-cols-2 gap-2">
            {['Income', 'Expense'].map((t) => {
              const isSelected = form.type === t;
              const isIncome = t === 'Income';
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, type: t }))}
                  className={[
                    'flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold',
                    'border transition-all duration-200 focus:outline-none focus:ring-2',
                    isSelected && isIncome
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm focus:ring-emerald-400'
                      : isSelected && !isIncome
                      ? 'bg-rose-500 border-rose-500 text-white shadow-sm focus:ring-rose-400'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 focus:ring-slate-400',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  {isIncome ? (
                    <ArrowUpCircle size={15} />
                  ) : (
                    <ArrowDownCircle size={15} />
                  )}
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Title field with Mic button ───────────────────────────────── */}
        <div>
          <label htmlFor="title" className="form-label">
            <span className="flex items-center gap-1.5">
              <Tag size={11} />
              Title
              {speechSupported && (
                <span className="text-emerald-500 dark:text-emerald-400 text-[10px] font-bold ml-1">
                  🎤 VOICE
                </span>
              )}
            </span>
          </label>
          <div className="flex gap-2">
            <input
              id="title"
              name="title"
              type="text"
              value={form.title}
              onChange={handleChange}
              placeholder={
                isListening && activeField === 'title'
                  ? '🎤 Listening…'
                  : 'e.g., Grocery run at D-Mart'
              }
              className={`input-field ${errors.title ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              maxLength={100}
              aria-describedby={errors.title ? 'title-error' : undefined}
              aria-invalid={!!errors.title}
            />
            {/* Mic button — only shown if Speech API is available */}
            {speechSupported && (
              <MicButton
                isListening={isListening}
                onClick={() => toggleDictation('title')}
                targetField="title"
                activeField={activeField}
              />
            )}
          </div>
          <FieldError message={errors.title} />
        </div>

        {/* ── Amount field ──────────────────────────────────────────────── */}
        <div>
          <label htmlFor="amount" className="form-label">
            <span className="flex items-center gap-1.5">
              <DollarSign size={11} />
              Amount (₹)
            </span>
          </label>
          <input
            id="amount"
            name="amount"
            type="number"
            value={form.amount}
            onChange={handleChange}
            placeholder="0.00"
            min="1"
            step="0.01"
            className={`input-field font-numeric ${errors.amount ? 'border-rose-400 focus:ring-rose-400' : ''}`}
            aria-invalid={!!errors.amount}
          />
          <FieldError message={errors.amount} />
        </div>

        {/* ── Category + Date row ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="category" className="form-label">
              <span className="flex items-center gap-1.5">
                <LayoutGrid size={11} />
                Category
              </span>
            </label>
            <select
              id="category"
              name="category"
              value={form.category}
              onChange={handleChange}
              className={`select-field ${errors.category ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              aria-invalid={!!errors.category}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            <FieldError message={errors.category} />
          </div>

          <div>
            <label htmlFor="date" className="form-label">
              <span className="flex items-center gap-1.5">
                <Calendar size={11} />
                Date
              </span>
            </label>
            <input
              id="date"
              name="date"
              type="date"
              value={form.date}
              onChange={handleChange}
              max={new Date().toISOString().split('T')[0]}
              className={`input-field ${errors.date ? 'border-rose-400 focus:ring-rose-400' : ''}`}
              aria-invalid={!!errors.date}
            />
            <FieldError message={errors.date} />
          </div>
        </div>

        {/* ── Notes field with Mic button ───────────────────────────────── */}
        <div>
          <label htmlFor="notes" className="form-label">
            <span className="flex items-center gap-1.5">
              <AlignLeft size={11} />
              Notes
              <span className="text-slate-400 dark:text-slate-500 normal-case tracking-normal font-normal">
                (optional)
              </span>
            </span>
          </label>
          <div className="flex gap-2 items-start">
            <textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={handleChange}
              placeholder={
                isListening && activeField === 'notes'
                  ? '🎤 Listening…'
                  : 'Any extra details…'
              }
              rows={2}
              maxLength={250}
              className="input-field resize-none"
            />
            {speechSupported && (
              <MicButton
                isListening={isListening}
                onClick={() => toggleDictation('notes')}
                targetField="notes"
                activeField={activeField}
              />
            )}
          </div>
        </div>

        {/* ── Recurring toggle (Phase D) ────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Toggle header */}
          <button
            type="button"
            onClick={() => setForm(prev => ({ ...prev, isRecurring: !prev.isRecurring }))}
            className="w-full flex items-center justify-between px-4 py-3
                       bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100
                       dark:hover:bg-slate-700/60 transition-colors duration-150
                       focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500"
            aria-pressed={form.isRecurring}
            aria-expanded={form.isRecurring}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <Repeat size={14} className={form.isRecurring ? 'text-emerald-500' : 'text-slate-400'} aria-hidden="true" />
              Recurring transaction
            </span>
            {/* Pill toggle */}
            <span
              className={[
                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200',
                form.isRecurring ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600',
              ].join(' ')}
              aria-hidden="true"
            >
              <span className={[
                'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200',
                form.isRecurring ? 'translate-x-4' : 'translate-x-0.5',
              ].join(' ')} />
            </span>
          </button>

          {/* Frequency selector — shown only when isRecurring is true */}
          {form.isRecurring && (
            <div className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-t border-slate-200 dark:border-slate-700 animate-slide-down">
              <label className="form-label">Repeat frequency</label>
              <div className="flex gap-2 mt-1">
                {RECURRING_FREQUENCIES.map(freq => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, recurringFrequency: freq }))}
                    className={[
                      'flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-all duration-150',
                      'border focus:outline-none focus:ring-2 focus:ring-emerald-400',
                      form.recurringFrequency === freq
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-300',
                    ].join(' ')}
                    aria-pressed={form.recurringFrequency === freq}
                  >
                    {freq}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
                🔄 The cron scheduler will auto-generate copies of this transaction at midnight IST.
              </p>
            </div>
          )}
        </div>

        {/* ── Submit row ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-1">
          <SuccessToast show={showSuccess} />

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary ml-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <PlusCircle size={15} />
                Add Transaction
              </>
            )}
          </button>
        </div>
      </form>

      {/* ── Voice Dictation Status Bar ────────────────────────────────────── */}
      {isListening && (
        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-700/50 rounded-xl animate-slide-down">
          {/* Animated sound wave dots */}
          <div className="flex items-end gap-0.5 h-4" aria-hidden="true">
            {[0, 100, 200, 100, 0].map((delay, i) => (
              <span
                key={i}
                className="w-1 bg-rose-500 rounded-full animate-pulse"
                style={{
                  height: `${8 + (i % 3) * 4}px`,
                  animationDelay: `${delay}ms`,
                }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
            Listening to{' '}
            <strong className="font-bold capitalize">{activeField}</strong>… speak now
          </span>
          <button
            type="button"
            onClick={() => toggleDictation(activeField)}
            className="ml-auto text-xs text-rose-500 hover:text-rose-700 font-semibold underline"
          >
            Stop
          </button>
        </div>
      )}

      {/* ── Browser support note ──────────────────────────────────────────── */}
      {!speechSupported && (
        <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
          <MicOff size={12} />
          Voice dictation requires Chrome or Edge.
        </p>
      )}
    </article>
  );
};

export default TransactionForm;