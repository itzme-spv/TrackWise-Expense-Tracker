/**
 * pages/RegisterPage.jsx
 *
 * User Registration Page
 *
 * Fields:
 *   - Full Name
 *   - Email
 *   - Password (with strength indicator + show/hide toggle)
 *   - Confirm Password
 *   - Monthly Budget goal (₹, defaults to 50,000)
 *
 * Validation: Client-side (HTML5 + JS) + server-side errors surfaced in UI
 *
 * MERN Data Flow:
 *   Form submit → axios.post('/api/auth/register', { name, email, password, monthlyBudget })
 *   → Express authController.registerUser → User.create() → bcrypt hash (pre-save hook)
 *   → jwt.sign → { success: true, token, user }
 *   → AuthContext.login(token, user) → Navigate('/dashboard')
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Wallet,
  ArrowRight,
  AlertCircle,
  IndianRupee,
  CheckCircle2,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Field Error ────────────────────────────────────────────────────────────────
const FieldError = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1.5 text-xs text-rose-500 mt-1.5 font-medium" role="alert">
      <AlertCircle size={11} aria-hidden="true" />
      {message}
    </p>
  ) : null;

// ── Password Strength Indicator ────────────────────────────────────────────────
/**
 * Computes a 0–4 strength score and renders coloured segment bars.
 * Rules: length ≥8, has uppercase, has number, has special char.
 */
const PasswordStrength = ({ password }) => {
  if (!password) return null;

  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^a-zA-Z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;

  const config = {
    0: { label: 'Too weak',  bars: [true,  false, false, false], color: 'bg-rose-500' },
    1: { label: 'Weak',      bars: [true,  false, false, false], color: 'bg-rose-400' },
    2: { label: 'Fair',      bars: [true,  true,  false, false], color: 'bg-amber-400' },
    3: { label: 'Good',      bars: [true,  true,  true,  false], color: 'bg-blue-400' },
    4: { label: 'Strong',    bars: [true,  true,  true,  true],  color: 'bg-emerald-500' },
  }[score];

  return (
    <div className="mt-2 space-y-1.5" aria-label={`Password strength: ${config.label}`}>
      {/* 4 segment bars */}
      <div className="flex gap-1" aria-hidden="true">
        {config.bars.map((active, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              active ? config.color : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      <p className={`text-xs font-semibold ${
        score <= 1 ? 'text-rose-500' :
        score === 2 ? 'text-amber-500' :
        score === 3 ? 'text-blue-500' : 'text-emerald-500'
      }`}>
        {config.label}
      </p>
    </div>
  );
};

// ── Background Decor ──────────────────────────────────────────────────────────
const BackgroundDecor = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div
      className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
      style={{
        backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
    <div className="absolute -top-40 -right-32 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl" />
    <div className="absolute -bottom-40 -left-32 w-96 h-96 bg-violet-400/10 dark:bg-violet-500/10 rounded-full blur-3xl" />
  </div>
);

// ── Feature Bullet ─────────────────────────────────────────────────────────────
const FeatureBullet = ({ text }) => (
  <li className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
    <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" aria-hidden="true" />
    {text}
  </li>
);

// ── Main RegisterPage ──────────────────────────────────────────────────────────
const RegisterPage = () => {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // ── Form state ────────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    monthlyBudget: '50000',
  });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  // ── Client-side validation ────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};

    if (!form.name.trim()) {
      newErrors.name = 'Full name is required.';
    } else if (form.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters.';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Please enter a valid email address.';
    }

    if (!form.password) {
      newErrors.password = 'Password is required.';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }

    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password.';
    } else if (form.password !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (form.monthlyBudget && (isNaN(Number(form.monthlyBudget)) || Number(form.monthlyBudget) < 1)) {
      newErrors.monthlyBudget = 'Budget must be a positive number.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Submission ────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      // MERN flow: React → Express → User.create (bcrypt) → JWT → React state
      const { data } = await axios.post('/api/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        monthlyBudget: Number(form.monthlyBudget) || 50000,
      });
      if (data.success) {
        login(data.token, data.user);  // Store JWT + set Axios header
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-10 transition-colors duration-300">
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

        {/* ── Brand Header ───────────────────────────────────────────── */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-700 shadow-lg mb-4 relative">
            <Wallet size={24} className="text-emerald-400" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Join TrackWise — free, forever.
          </p>
        </div>

        {/* ── Register Card ───────────────────────────────────────────── */}
        <article className="card">
          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* API Error */}
            {apiError && (
              <div className="alert-danger text-xs animate-slide-down" role="alert">
                <AlertCircle size={15} className="flex-shrink-0" />
                {apiError}
              </div>
            )}

            {/* Full Name */}
            <div>
              <label htmlFor="reg-name" className="form-label">Full name</label>
              <div className="relative">
                <User size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="reg-name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Arjun Sharma"
                  className={`input-field pl-10 ${errors.name ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  aria-invalid={!!errors.name}
                  maxLength={60}
                />
              </div>
              <FieldError message={errors.name} />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="reg-email" className="form-label">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="reg-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                  className={`input-field pl-10 ${errors.email ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  aria-invalid={!!errors.email}
                />
              </div>
              <FieldError message={errors.email} />
            </div>

            {/* Password + strength meter */}
            <div>
              <label htmlFor="reg-password" className="form-label">Password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="reg-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Min. 6 characters"
                  className={`input-field pl-10 pr-11 ${errors.password ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  aria-invalid={!!errors.password}
                />
                <button type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Password strength indicator — shows as user types */}
              <PasswordStrength password={form.password} />
              <FieldError message={errors.password} />
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="reg-confirm" className="form-label">Confirm password</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="reg-confirm"
                  name="confirmPassword"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter your password"
                  className={`input-field pl-10 pr-11 ${errors.confirmPassword ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  aria-invalid={!!errors.confirmPassword}
                />
                <button type="button"
                  onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                >
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Match indicator */}
              {form.confirmPassword && form.password === form.confirmPassword && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-500 mt-1.5 font-medium">
                  <CheckCircle2 size={11} aria-hidden="true" />
                  Passwords match
                </p>
              )}
              <FieldError message={errors.confirmPassword} />
            </div>

            {/* Monthly Budget */}
            <div>
              <label htmlFor="reg-budget" className="form-label">
                Monthly budget goal
                <span className="ml-1.5 normal-case tracking-normal font-normal text-slate-400">(optional)</span>
              </label>
              <div className="relative">
                <IndianRupee size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="reg-budget"
                  name="monthlyBudget"
                  type="number"
                  value={form.monthlyBudget}
                  onChange={handleChange}
                  placeholder="50000"
                  min="1"
                  className={`input-field pl-10 font-numeric ${errors.monthlyBudget ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  aria-invalid={!!errors.monthlyBudget}
                />
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Used for the monthly budget progress bar. You can change this later.
              </p>
              <FieldError message={errors.monthlyBudget} />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base mt-1"
            >
              {isSubmitting ? (
                <><Loader2 size={17} className="animate-spin" />Creating account…</>
              ) : (
                <>Create account<ArrowRight size={17} /></>
              )}
            </button>
          </form>

          {/* Feature list */}
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-700">
            <ul className="space-y-2">
              <FeatureBullet text="Voice-powered expense dictation" />
              <FeatureBullet text="Real-time spending insights & alerts" />
              <FeatureBullet text="CSV export for all your transactions" />
            </ul>
          </div>

          {/* Divider + login link */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-slate-800 px-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                Already have an account?
              </span>
            </div>
          </div>

          <Link to="/login" className="btn-secondary w-full py-2.5 justify-center">
            Sign in instead
          </Link>
        </article>
      </div>
    </main>
  );
};

export default RegisterPage;
