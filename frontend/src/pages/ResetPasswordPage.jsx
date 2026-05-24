/**
 * pages/ResetPasswordPage.jsx  (Auth Upgrade — Phase 4B)
 *
 * Renders at: /reset-password/:token
 *
 * Flow:
 *   1. Extract :token from URL via useParams
 *   2. User enters new password + confirmation
 *   3. Client validates passwords match and meet length requirement
 *   4. PUT /api/auth/resetpassword/:token
 *   5. On success — backend returns { token, user } (auto-login)
 *      → persist session via login() → navigate to /dashboard
 *   6. On failure (expired/invalid token) — show a clear error card
 *      with a link to request a new reset link
 *
 * This route is intentionally outside PublicRoute/ProtectedRoute in App.jsx
 * because the user arrives from an email link while unauthenticated.
 */

import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Lock, Eye, EyeOff, Loader2, Wallet,
  CheckCircle2, XCircle, ArrowRight,
  ShieldCheck, Sun, Moon, AlertCircle,
} from 'lucide-react';
import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

// ── Background decoration ──────────────────────────────────────────────────────
const BackgroundDecor = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div
      className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
      style={{
        backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
    <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
  </div>
);

// ── Password strength meter ────────────────────────────────────────────────────
const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const checks  = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const map   = {
    0: { label: 'Too weak',  color: 'bg-rose-500',    text: 'text-rose-500',    filled: 1 },
    1: { label: 'Weak',      color: 'bg-rose-400',    text: 'text-rose-400',    filled: 1 },
    2: { label: 'Fair',      color: 'bg-amber-400',   text: 'text-amber-500',   filled: 2 },
    3: { label: 'Good',      color: 'bg-blue-400',    text: 'text-blue-500',    filled: 3 },
    4: { label: 'Strong',    color: 'bg-emerald-500', text: 'text-emerald-500', filled: 4 },
  };
  const { label, color, text, filled } = map[score];
  return (
    <div className="mt-2 space-y-1.5" aria-label={`Password strength: ${label}`}>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < filled ? color : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-semibold ${text}`}>{label}</p>
    </div>
  );
};

// ── Field error ────────────────────────────────────────────────────────────────
const FieldError = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1.5 text-xs text-rose-500 mt-1.5 font-medium" role="alert">
      <AlertCircle size={11} aria-hidden="true" />
      {message}
    </p>
  ) : null;

// ── Success state ──────────────────────────────────────────────────────────────
const SuccessCard = ({ onGoToDashboard }) => (
  <article className="card text-center space-y-5 py-10">
    <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto ring-1 ring-emerald-200 dark:ring-emerald-800">
      <CheckCircle2 size={38} className="text-emerald-500" aria-hidden="true" />
    </div>
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Password reset!
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
        Your password has been updated successfully. You're now signed in.
      </p>
    </div>
    <button onClick={onGoToDashboard} className="btn-primary w-full py-3 text-base">
      Go to Dashboard
      <ArrowRight size={17} />
    </button>
  </article>
);

// ── Token invalid/expired error state ─────────────────────────────────────────
const TokenErrorCard = ({ message }) => (
  <article className="card text-center space-y-5 py-10">
    <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mx-auto ring-1 ring-rose-200 dark:ring-rose-800">
      <XCircle size={38} className="text-rose-500" aria-hidden="true" />
    </div>
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Link expired
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
        {message || 'This reset link is invalid or has expired. Reset links are only valid for 15 minutes.'}
      </p>
    </div>
    <div className="flex flex-col gap-2">
      <Link to="/forgot-password" className="btn-primary w-full py-2.5 justify-center">
        Request a new link
        <ArrowRight size={15} />
      </Link>
      <Link to="/login" className="btn-secondary w-full py-2.5 justify-center">
        Back to Sign In
      </Link>
    </div>
  </article>
);

// ── Main ResetPasswordPage ─────────────────────────────────────────────────────
const ResetPasswordPage = () => {
  const { token }               = useParams();
  const navigate                = useNavigate();
  const { login }               = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { toast }               = useToast();

  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm,  setShowConfirm]    = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);

  // null = form visible, 'success' = done, 'token_error' = bad/expired token
  const [screenState, setScreenState]     = useState(null);
  const [tokenErrMsg, setTokenErrMsg]     = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(p => ({ ...p, [name]: value }));
    if (errors[name]) setErrors(p => ({ ...p, [name]: '' }));
  };

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.password)
      e.password = 'New password is required.';
    else if (form.password.length < 6)
      e.password = 'Password must be at least 6 characters.';

    if (!form.confirmPassword)
      e.confirmPassword = 'Please confirm your new password.';
    else if (form.password !== form.confirmPassword)
      e.confirmPassword = 'Passwords do not match.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      // PUT /api/auth/resetpassword/:token
      // Backend validates the token + expiry, hashes the new password, returns JWT
      const { data } = await axios.put(`/api/auth/resetpassword/${token}`, {
        password: form.password,
      });

      if (data.success) {
        // Auto-login — backend sends { token, user } just like a standard login
        login(data.token, data.user);
        toast.success('Password reset successfully!', 'Done');
        setScreenState('success');
      }
    } catch (err) {
      const msg  = err?.response?.data?.message || '';
      const code = err?.response?.status;

      // 400 = invalid/expired token (the most common failure path)
      if (code === 400) {
        setTokenErrMsg(msg);
        setScreenState('token_error');
      } else {
        // 5xx or network error — keep the form visible, show a toast
        toast.error(msg || 'Something went wrong. Please try again.', 'Error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordsMatch =
    form.confirmPassword.length > 0 &&
    form.password === form.confirmPassword;

  // ── Conditional screens ──────────────────────────────────────────────────
  if (screenState === 'success') {
    return (
      <main className="relative min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12 transition-colors duration-300">
        <BackgroundDecor />
        <div className="relative w-full max-w-md">
          <SuccessCard onGoToDashboard={() => navigate('/dashboard', { replace: true })} />
        </div>
      </main>
    );
  }

  if (screenState === 'token_error') {
    return (
      <main className="relative min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12 transition-colors duration-300">
        <BackgroundDecor />
        <div className="relative w-full max-w-md">
          <TokenErrorCard message={tokenErrMsg} />
        </div>
      </main>
    );
  }

  // ── Main form ─────────────────────────────────────────────────────────────
  return (
    <main className="relative min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12 transition-colors duration-300">
      <BackgroundDecor />

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        className="absolute top-5 right-5 btn-ghost"
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDark
          ? <Sun size={18} className="text-amber-400" />
          : <Moon size={18} className="text-slate-500" />
        }
      </button>

      <div className="relative w-full max-w-md">

        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-700 shadow-lg mb-4 relative">
            <Wallet size={24} className="text-emerald-400" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Set a new password
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">
            Choose a strong password you haven't used before.
          </p>
        </div>

        <article className="card space-y-5">

          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* ── New password ──────────────────────────────────────────── */}
            <div>
              <label htmlFor="reset-password" className="form-label">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={11} aria-hidden="true" />
                  New password
                </span>
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="reset-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className={`input-field pl-10 pr-11 ${
                    errors.password ? 'border-rose-400 focus:ring-rose-400' : ''
                  }`}
                  aria-invalid={!!errors.password}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Live strength meter */}
              <PasswordStrength password={form.password} />
              <FieldError message={errors.password} />
            </div>

            {/* ── Confirm password ──────────────────────────────────────── */}
            <div>
              <label htmlFor="reset-confirm" className="form-label">
                Confirm new password
              </label>
              <div className="relative">
                <Lock
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="reset-confirm"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={`input-field pl-10 pr-11 ${
                    errors.confirmPassword ? 'border-rose-400 focus:ring-rose-400' : ''
                  }`}
                  aria-invalid={!!errors.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              {/* Passwords-match indicator */}
              {passwordsMatch && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-500 mt-1.5 font-medium">
                  <CheckCircle2 size={11} aria-hidden="true" />
                  Passwords match
                </p>
              )}
              <FieldError message={errors.confirmPassword} />
            </div>

            {/* ── Requirements hint ─────────────────────────────────────── */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Requirements
              </p>
              {[
                { label: 'At least 6 characters',       met: form.password.length >= 6 },
                { label: 'At least one uppercase letter', met: /[A-Z]/.test(form.password) },
                { label: 'At least one number',          met: /[0-9]/.test(form.password) },
              ].map(({ label, met }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-200 ${
                    form.password.length === 0
                      ? 'bg-slate-300 dark:bg-slate-600'
                      : met
                        ? 'bg-emerald-500'
                        : 'bg-rose-400'
                  }`} aria-hidden="true" />
                  <span className={`text-xs transition-colors duration-200 ${
                    form.password.length === 0
                      ? 'text-slate-400 dark:text-slate-500'
                      : met
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-rose-500'
                  }`}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {/* ── Submit ────────────────────────────────────────────────── */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base"
            >
              {isSubmitting
                ? <><Loader2 size={17} className="animate-spin" />Resetting password…</>
                : <><ShieldCheck size={17} />Reset my password</>
              }
            </button>
          </form>

          {/* Divider + back link */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-slate-800 px-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                Changed your mind?
              </span>
            </div>
          </div>

          <Link to="/login" className="btn-secondary w-full py-2.5 justify-center">
            Back to Sign In
          </Link>
        </article>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          This reset link is single-use and expires after 15 minutes.
        </p>
      </div>
    </main>
  );
};

export default ResetPasswordPage;