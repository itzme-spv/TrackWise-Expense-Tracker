/**
 * pages/LoginPage.jsx
 *
 * User Login Page
 *
 * Responsibilities:
 *   - Renders a login form with Email + Password fields
 *   - Client-side validation (HTML5 + JS) before hitting the API
 *   - Calls POST /api/auth/login → receives { token, user } on success
 *   - Calls AuthContext.login(token, user) to persist the JWT globally
 *   - Navigates to /dashboard on success
 *   - Displays field-level and API-level error messages
 *   - Password visibility toggle
 *   - Links to /register for new users
 *
 * MERN Data Flow:
 *   Form submit → axios.post('/api/auth/login', { email, password })
 *   → Express authController.loginUser → bcrypt.compare → jwt.sign
 *   → { success: true, token, user } → AuthContext.login(token, user)
 *   → localStorage + Axios header set → Navigate('/dashboard')
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  Wallet,
  ArrowRight,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// ── Reusable Field Error ───────────────────────────────────────────────────────
const FieldError = ({ message }) =>
  message ? (
    <p className="flex items-center gap-1.5 text-xs text-rose-500 mt-1.5 font-medium" role="alert">
      <AlertCircle size={11} aria-hidden="true" />
      {message}
    </p>
  ) : null;

// ── Decorative Background ─────────────────────────────────────────────────────
const BackgroundDecor = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div
      className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
      style={{
        backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    />
    <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/10 dark:bg-emerald-500/10 rounded-full blur-3xl" />
    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-400/10 dark:bg-blue-500/10 rounded-full blur-3xl" />
  </div>
);

// ── Main LoginPage ─────────────────────────────────────────────────────────────
const LoginPage = () => {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  // After login, redirect to original destination (set by ProtectedRoute)
  const from = location.state?.from?.pathname || '/dashboard';

  // ── Form state ──────────────────────────────────────────────────────────────
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    if (apiError) setApiError('');
  };

  // ── Client-side validation ──────────────────────────────────────────────────
  const validate = () => {
    const newErrors = {};
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
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ── Form submission ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setApiError('');
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      // MERN flow: React → Express → Mongoose → JWT → React state
      const { data } = await axios.post('/api/auth/login', {
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });
      if (data.success) {
        login(data.token, data.user);  // Persist JWT in AuthContext + localStorage
        navigate(from, { replace: true });
      }
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* ── Brand Header ──────────────────────────────────────────── */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-700 shadow-lg mb-4 relative">
            <Wallet size={24} className="text-emerald-400" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
            Sign in to your TrackWise account
          </p>
        </div>

        {/* ── Login Card ─────────────────────────────────────────────── */}
        <article className="card">
          <form onSubmit={handleSubmit} noValidate className="space-y-5">

            {/* API Error */}
            {apiError && (
              <div className="alert-danger text-xs animate-slide-down" role="alert">
                <AlertCircle size={15} className="flex-shrink-0" />
                {apiError}
              </div>
            )}

            {/* Email */}
            <div>
              <label htmlFor="login-email" className="form-label">Email address</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="login-email"
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

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="form-label mb-0">Password</label>
                <button type="button" tabIndex={-1}
                  className="text-xs text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 font-semibold transition-colors">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" aria-hidden="true" />
                <input
                  id="login-password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`input-field pl-10 pr-11 ${errors.password ? 'border-rose-400 focus:ring-rose-400' : ''}`}
                  aria-invalid={!!errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors p-0.5"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <FieldError message={errors.password} />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-full py-3 text-base mt-2"
            >
              {isSubmitting ? (
                <><Loader2 size={17} className="animate-spin" />Signing in…</>
              ) : (
                <>Sign in<ArrowRight size={17} /></>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-slate-100 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-slate-800 px-3 text-xs text-slate-400 dark:text-slate-500 font-medium">
                New to TrackWise?
              </span>
            </div>
          </div>

          <Link to="/register" className="btn-secondary w-full py-2.5 justify-center">
            Create a free account
          </Link>
        </article>

        <p className="text-center text-xs text-slate-400 dark:text-slate-600 mt-6">
          Secured with JWT authentication &amp; bcrypt encryption.
        </p>
      </div>
    </main>
  );
};

export default LoginPage;
