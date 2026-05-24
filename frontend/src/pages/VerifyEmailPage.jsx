/**
 * pages/VerifyEmailPage.jsx  (Auth Upgrade — Phase 4B)
 *
 * Renders at: /verify-email/:token
 *
 * Flow:
 *   1. Extract :token from URL via useParams
 *   2. On mount, call GET /api/auth/verifyemail/:token
 *   3. Show a spinner while the request is in-flight
 *   4. On success → show green confirmation + "Go to Dashboard" button
 *      (backend already issued a JWT; we persist it via login())
 *   5. On failure → show red error card + "Back to Login" link
 *
 * This route is intentionally NOT wrapped in PublicRoute or ProtectedRoute
 * in App.jsx — the user is unauthenticated when they click the email link.
 */

import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  CheckCircle2, XCircle, Loader2,
  Wallet, ArrowRight, MailX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// ── Status values ──────────────────────────────────────────────────────────────
const STATUS = { LOADING: 'loading', SUCCESS: 'success', ERROR: 'error' };

// ── Background decoration ──────────────────────────────────────────────────────
const BackgroundDecor = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
    <div
      className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
      style={{ backgroundImage: 'radial-gradient(circle, #10b981 1px, transparent 1px)', backgroundSize: '28px 28px' }}
    />
    <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-400/10 rounded-full blur-3xl" />
    <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-400/10 rounded-full blur-3xl" />
  </div>
);

// ── Loading state ──────────────────────────────────────────────────────────────
const LoadingCard = () => (
  <article className="card text-center space-y-5 py-12">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mx-auto">
      <Loader2 size={28} className="text-emerald-500 animate-spin" aria-hidden="true" />
    </div>
    <div className="space-y-1.5">
      <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Verifying your email…
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        This will only take a moment. Please don't close this tab.
      </p>
    </div>
    {/* Animated progress bar */}
    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mx-auto max-w-xs">
      <div className="h-full bg-emerald-500 rounded-full animate-shimmer"
        style={{ width: '60%', animationDuration: '1.5s' }} aria-hidden="true" />
    </div>
  </article>
);

// ── Success state ──────────────────────────────────────────────────────────────
const SuccessCard = ({ onGoToDashboard }) => (
  <article className="card text-center space-y-5 py-10">
    {/* Icon */}
    <div className="w-20 h-20 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto ring-1 ring-emerald-200 dark:ring-emerald-800">
      <CheckCircle2 size={38} className="text-emerald-500" aria-hidden="true" />
    </div>

    {/* Heading */}
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Email verified!
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
        Your email address has been confirmed. Your account is now fully active.
      </p>
    </div>

    {/* Feature highlights */}
    <div className="grid grid-cols-3 gap-2 text-xs text-slate-500 dark:text-slate-400">
      {['📊 Smart Insights', '🎤 Voice Entry', '📥 CSV Export'].map(f => (
        <div key={f} className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-2.5 font-medium">
          {f}
        </div>
      ))}
    </div>

    {/* CTA */}
    <button
      onClick={onGoToDashboard}
      className="btn-primary w-full py-3 text-base"
    >
      Go to Dashboard
      <ArrowRight size={17} />
    </button>
  </article>
);

// ── Error state ────────────────────────────────────────────────────────────────
const ErrorCard = ({ message }) => (
  <article className="card text-center space-y-5 py-10">
    {/* Icon */}
    <div className="w-20 h-20 rounded-full bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center mx-auto ring-1 ring-rose-200 dark:ring-rose-800">
      <MailX size={34} className="text-rose-500" aria-hidden="true" />
    </div>

    {/* Heading */}
    <div className="space-y-2">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
        Verification failed
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs mx-auto">
        {message || 'This verification link is invalid or has expired.'}
      </p>
    </div>

    {/* What to do */}
    <div className="text-left bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">What you can do:</p>
      <ul className="space-y-1.5">
        {[
          'Register again with the same email — a new link will be sent.',
          'Check your spam/junk folder for the original email.',
          'Links expire after 24 hours — if yours has, simply re-register.',
        ].map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
            <span className="mt-0.5 flex-shrink-0">•</span>
            {tip}
          </li>
        ))}
      </ul>
    </div>

    {/* Actions */}
    <div className="flex flex-col gap-2">
      <Link to="/register" className="btn-primary w-full py-2.5 justify-center">
        Register again
      </Link>
      <Link to="/login" className="btn-secondary w-full py-2.5 justify-center">
        Back to Sign In
      </Link>
    </div>
  </article>
);

// ── Main VerifyEmailPage ───────────────────────────────────────────────────────
const VerifyEmailPage = () => {
  const { token }    = useParams();
  const navigate     = useNavigate();
  const { login }    = useAuth();

  const [status,  setStatus]  = useState(STATUS.LOADING);
  const [message, setMessage] = useState('');

  // ── Call backend once on mount ─────────────────────────────────────────────
  useEffect(() => {
    // Guard: if somehow this page loads without a token, fail immediately
    if (!token) {
      setStatus(STATUS.ERROR);
      setMessage('No verification token found in the URL.');
      return;
    }

    const verify = async () => {
      try {
        // GET /api/auth/verifyemail/:token
        // On success the backend returns { success, token, user } — same as login
        const { data } = await axios.get(`/api/auth/verifyemail/${token}`);

        if (data.success) {
          // Persist the session exactly like a standard login
          login(data.token, data.user);
          setStatus(STATUS.SUCCESS);
        } else {
          setStatus(STATUS.ERROR);
          setMessage(data.message);
        }
      } catch (err) {
        setStatus(STATUS.ERROR);
        setMessage(
          err?.response?.data?.message ||
          'Invalid or expired verification link. Please register again.'
        );
      }
    };

    verify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty — intentional: run once on mount only, token won't change

  const handleGoToDashboard = () => navigate('/dashboard', { replace: true });

  return (
    <main className="relative min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center px-4 py-12 transition-colors duration-300">
      <BackgroundDecor />

      <div className="relative w-full max-w-md">
        {/* Brand mark */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-700 shadow-lg mb-4 relative">
            <Wallet size={24} className="text-emerald-400" />
            <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10" />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">Email Verification</p>
        </div>

        {/* Conditional render based on status */}
        {status === STATUS.LOADING && <LoadingCard />}
        {status === STATUS.SUCCESS && <SuccessCard onGoToDashboard={handleGoToDashboard} />}
        {status === STATUS.ERROR   && <ErrorCard message={message} />}
      </div>
    </main>
  );
};

export default VerifyEmailPage;