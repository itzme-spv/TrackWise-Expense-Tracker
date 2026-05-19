/**
 * components/Onboarding.jsx
 *
 * 3-Step Onboarding Wizard Modal
 *
 * Shown automatically to new users on their first login.
 * Persisted with a localStorage flag `trackwise_onboarded` — once dismissed
 * or completed, it never shows again.
 *
 * Step Flow:
 *   Step 1 — Welcome + Set Monthly Budget goal
 *   Step 2 — Add First Income transaction (e.g., salary)
 *   Step 3 — Add First Expense transaction + completion celebration
 *
 * Architecture:
 *   - Modal overlay rendered via React.createPortal to <body>
 *   - Each step is a self-contained sub-component
 *   - The wizard is skippable at any step via the "Skip setup" link
 *   - On completion/skip: sets localStorage flag → parent unmounts it
 *
 * Integration (App.jsx / DashboardPage.jsx):
 *   import { useOnboarding } from '../components/Onboarding';
 *   const { OnboardingModal } = useOnboarding();
 *   // In JSX:
 *   <OnboardingModal onComplete={handleOnboardingDone} />
 *
 * MERN Data Flow:
 *   Step 1 → PUT /api/auth/budget  (updates monthlyBudget in MongoDB)
 *   Step 2 → POST /api/transactions (creates Income transaction)
 *   Step 3 → POST /api/transactions (creates Expense transaction)
 *   → On completion: AuthContext.updateUser() patches local budget state
 *   → DashboardPage refreshKey++ to re-fetch summary
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  X,
  Loader2,
  Target,
  Sparkles,
  IndianRupee,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

// ── localStorage key ───────────────────────────────────────────────────────────
const ONBOARDING_KEY = 'trackwise_onboarded';

// ── Step progress dots ─────────────────────────────────────────────────────────
const StepDots = ({ current, total }) => (
  <div className="flex items-center justify-center gap-2" aria-label={`Step ${current + 1} of ${total}`}>
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={[
          'rounded-full transition-all duration-300',
          i === current
            ? 'w-6 h-2 bg-emerald-500'
            : i < current
            ? 'w-2 h-2 bg-emerald-300 dark:bg-emerald-700'
            : 'w-2 h-2 bg-slate-200 dark:bg-slate-600',
        ].join(' ')}
        aria-hidden="true"
      />
    ))}
  </div>
);

// ── Step 1: Welcome + Budget ───────────────────────────────────────────────────
const StepWelcome = ({ onNext, isLoading }) => {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [budget, setBudget] = useState(user?.monthlyBudget?.toString() || '50000');
  const [error, setError] = useState('');

  const handleNext = async () => {
    const val = Number(budget);
    if (!budget || isNaN(val) || val < 1) {
      setError('Please enter a valid budget amount (minimum ₹1).');
      return;
    }
    setError('');

    try {
      const { data } = await axios.put('/api/auth/budget', { monthlyBudget: val });
      if (data.success) {
        // Patch local AuthContext so the Navbar shows the updated budget
        updateUser({ monthlyBudget: val });
        toast.success(`Monthly budget set to ₹${val.toLocaleString('en-IN')}!`);
        onNext();
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save budget.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Icon + heading */}
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto shadow-glow-emerald">
          <Wallet size={30} className="text-white" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Welcome to TrackWise, {user?.name?.split(' ')[0]}! 🎉
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          Let's get your finances set up in 3 quick steps. First — what's your monthly spending goal?
        </p>
      </div>

      {/* Budget input */}
      <div className="space-y-2">
        <label htmlFor="ob-budget" className="form-label">
          <span className="flex items-center gap-1.5">
            <Target size={11} />
            Monthly budget goal
          </span>
        </label>
        <div className="relative">
          <IndianRupee
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            aria-hidden="true"
          />
          <input
            id="ob-budget"
            type="number"
            value={budget}
            onChange={(e) => { setBudget(e.target.value); setError(''); }}
            placeholder="50000"
            min="1"
            className={`input-field pl-10 font-numeric text-lg ${error ? 'border-rose-400 focus:ring-rose-400' : ''}`}
          />
        </div>
        {error && (
          <p className="text-xs text-rose-500 font-medium" role="alert">{error}</p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500">
          This drives the budget progress bar on your dashboard. You can change it anytime in Settings.
        </p>
      </div>

      <button onClick={handleNext} disabled={isLoading} className="btn-primary w-full py-3">
        {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={16} />Set my budget</>}
      </button>
    </div>
  );
};

// ── Step 2: First Income ───────────────────────────────────────────────────────
const StepIncome = ({ onNext, onBack, isLoading }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: 'Monthly Salary', amount: '', category: 'Salary' });
  const [error, setError] = useState('');

  const INCOME_CATEGORIES = ['Salary', 'Housing', 'Other'];

  const handleNext = async () => {
    if (!form.amount || Number(form.amount) < 1) {
      setError('Please enter a valid income amount.');
      return;
    }
    if (!form.title.trim()) {
      setError('Please enter a title.');
      return;
    }
    setError('');

    try {
      await axios.post('/api/transactions', {
        title:    form.title.trim(),
        amount:   Number(form.amount),
        type:     'Income',
        category: form.category,
        date:     new Date().toISOString(),
      });
      toast.success('Income recorded!', `₹${Number(form.amount).toLocaleString('en-IN')} added.`);
      onNext();
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save income.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
          <TrendingUp size={30} className="text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Log your first income
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          Add a salary or any income source so TrackWise can calculate your savings rate.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="ob-income-title" className="form-label">Title</label>
          <input
            id="ob-income-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
            className="input-field"
            placeholder="e.g., Monthly Salary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ob-income-amount" className="form-label">Amount (₹)</label>
            <input
              id="ob-income-amount"
              type="number"
              value={form.amount}
              onChange={(e) => { setForm(p => ({ ...p, amount: e.target.value })); setError(''); }}
              className={`input-field font-numeric ${error ? 'border-rose-400' : ''}`}
              placeholder="75000"
              min="1"
            />
          </div>
          <div>
            <label htmlFor="ob-income-cat" className="form-label">Category</label>
            <select
              id="ob-income-cat"
              value={form.category}
              onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
              className="select-field"
            >
              {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500 font-medium" role="alert">{error}</p>}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex-shrink-0">
          <ArrowLeft size={15} />
        </button>
        <button onClick={handleNext} disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><ArrowRight size={16} />Add income</>}
        </button>
      </div>
    </div>
  );
};

// ── Step 3: First Expense + Celebration ───────────────────────────────────────
const StepExpense = ({ onComplete, onBack, isLoading }) => {
  const { toast } = useToast();
  const [form, setForm] = useState({ title: '', amount: '', category: 'Food & Groceries' });
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const EXPENSE_CATEGORIES = [
    'Housing', 'Food & Groceries', 'Transport',
    'Utilities', 'Entertainment', 'Healthcare', 'Other',
  ];

  const handleFinish = async () => {
    if (!form.amount || Number(form.amount) < 1) {
      setError('Please enter a valid expense amount.');
      return;
    }
    if (!form.title.trim()) {
      setError('Please enter a title.');
      return;
    }
    setError('');

    try {
      await axios.post('/api/transactions', {
        title:    form.title.trim(),
        amount:   Number(form.amount),
        type:     'Expense',
        category: form.category,
        date:     new Date().toISOString(),
      });
      setDone(true);
      toast.success('Setup complete! 🎉', 'Your dashboard is ready.');
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save expense.');
    }
  };

  // Celebration screen shown after both transactions are saved
  if (done) {
    return (
      <div className="text-center space-y-6 py-4">
        <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto animate-pulse-soft">
          <CheckCircle2 size={40} className="text-emerald-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            You're all set! 🚀
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
            Your dashboard is loaded with your first transactions. Explore your spending insights and keep tracking!
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs text-slate-500 dark:text-slate-400">
          {['📊 Smart Insights', '🎤 Voice Entry', '📥 CSV Export'].map(f => (
            <div key={f} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 font-medium">{f}</div>
          ))}
        </div>
        <button onClick={onComplete} className="btn-primary w-full py-3">
          <Sparkles size={16} />
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 rounded-2xl bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
          <TrendingDown size={30} className="text-rose-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          Log your first expense
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
          Almost done! Add any recent expense — groceries, rent, transport — whatever comes to mind.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="ob-exp-title" className="form-label">Title</label>
          <input
            id="ob-exp-title"
            type="text"
            value={form.title}
            onChange={(e) => setForm(p => ({ ...p, title: e.target.value }))}
            className="input-field"
            placeholder="e.g., Weekly groceries"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ob-exp-amount" className="form-label">Amount (₹)</label>
            <input
              id="ob-exp-amount"
              type="number"
              value={form.amount}
              onChange={(e) => { setForm(p => ({ ...p, amount: e.target.value })); setError(''); }}
              className={`input-field font-numeric ${error ? 'border-rose-400' : ''}`}
              placeholder="850"
              min="1"
            />
          </div>
          <div>
            <label htmlFor="ob-exp-cat" className="form-label">Category</label>
            <select
              id="ob-exp-cat"
              value={form.category}
              onChange={(e) => setForm(p => ({ ...p, category: e.target.value }))}
              className="select-field"
            >
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-rose-500 font-medium" role="alert">{error}</p>}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-secondary flex-shrink-0">
          <ArrowLeft size={15} />
        </button>
        <button onClick={handleFinish} disabled={isLoading} className="btn-primary flex-1">
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} />Finish setup</>}
        </button>
      </div>
    </div>
  );
};

// ── Onboarding Modal Shell ─────────────────────────────────────────────────────
/**
 * The outer modal with backdrop, step dots, and skip link.
 * Rendered via createPortal to escape any overflow:hidden ancestor.
 */
const OnboardingModal = ({ onComplete }) => {
  const [step, setStep]       = useState(0);
  const [isLoading]           = useState(false);  // Reserved for future global loading state

  const TOTAL_STEPS = 3;

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete?.();
  };

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    onComplete?.();
  };

  const steps = [
    <StepWelcome key={0} onNext={() => setStep(1)} isLoading={isLoading} />,
    <StepIncome  key={1} onNext={() => setStep(2)} onBack={() => setStep(0)} isLoading={isLoading} />,
    <StepExpense key={2} onComplete={handleComplete} onBack={() => setStep(1)} isLoading={isLoading} />,
  ];

  return createPortal(
    // Full-screen backdrop
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
      aria-label="Onboarding wizard"
    >
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm"
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-slide-down">

        {/* Top accent bar */}
        <div className="h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-400" aria-hidden="true" />

        {/* Skip button — top right */}
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 btn-ghost p-1.5 text-slate-400"
          aria-label="Skip onboarding setup"
          title="Skip setup"
        >
          <X size={16} />
        </button>

        {/* Modal content */}
        <div className="px-6 pt-6 pb-3">
          {steps[step]}
        </div>

        {/* Footer: step dots + skip text link */}
        <div className="px-6 pt-3 pb-5 flex flex-col items-center gap-3">
          <StepDots current={step} total={TOTAL_STEPS} />
          {step < 2 && (
            <button
              onClick={handleSkip}
              className="text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 transition-colors"
            >
              Skip setup — I'll explore on my own
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

// ── useOnboarding Hook ─────────────────────────────────────────────────────────
/**
 * Encapsulates the logic for deciding whether to show the wizard.
 *
 * Returns:
 *   shouldShow {boolean}   — True if the wizard should be displayed
 *   markComplete {function} — Call to permanently dismiss the wizard
 *
 * Logic:
 *   - Read `trackwise_onboarded` from localStorage
 *   - If missing AND user exists (i.e., just registered), show the wizard
 *   - After completion/skip, write the flag to prevent future shows
 */
export const useOnboarding = () => {
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (!done) setShouldShow(true);
  }, [user]);

  const markComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true');
    setShouldShow(false);
  };

  return { shouldShow, markComplete, OnboardingModal };
};

export { OnboardingModal };
export default OnboardingModal;