/**
 * App.jsx — Root Application Component
 *
 * Responsibilities:
 *   1. Wraps the entire app in context providers (Auth, Theme)
 *   2. Defines all client-side routes using React Router v6
 *   3. Implements a <ProtectedRoute> guard that redirects unauthenticated
 *      users to /login before they can access dashboard pages
 *   4. Implements a React Error Boundary for top-level error catching
 *   5. Shows a full-screen loading spinner while session is being restored
 *
 * Route Map:
 *   /               → Redirects to /dashboard (if auth) or /login
 *   /login          → LoginPage   (public)
 *   /register       → RegisterPage (public)
 *   /dashboard      → DashboardPage (protected)
 *   /history        → HistoryPage   (protected)
 *   *               → NotFoundPage
 *
 * MERN Data Flow:
 *   AuthContext reads localStorage JWT on mount → validates via GET /api/auth/me
 *   → sets `user` state → ProtectedRoute either renders children or redirects.
 */

import { Component } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';

// Layout
import Navbar from './components/Navbar';

// Pages — imported lazily in Phase 3; placeholders used now
// These will be replaced by full implementations in subsequent phases
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import HistoryPage from './pages/HistoryPage';
import NotFoundPage from './pages/NotFoundPage';

// ── React Error Boundary ──────────────────────────────────────────────────────
/**
 * ErrorBoundary — Class component (required by React's Error Boundary API).
 * Catches any unhandled JS errors in the component tree below it and
 * renders a fallback UI instead of a blank/crashed screen.
 *
 * Note: Hooks cannot be used inside Error Boundaries — they MUST be class components.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Invoked when a descendant throws — used to update state
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // Invoked after rendering the fallback — good place to log to an error service
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-6">
          <section className="card max-w-md w-full text-center space-y-4">
            {/* Error icon */}
            <div className="w-16 h-16 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center mx-auto">
              <span className="text-3xl">⚠️</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Something went wrong
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              An unexpected error occurred. Your data is safe.
            </p>
            {/* Show error message in development */}
            {import.meta.env.DEV && (
              <pre className="text-left text-xs bg-slate-100 dark:bg-slate-800 rounded-lg p-3 overflow-auto max-h-32 text-rose-600">
                {this.state.error?.message}
              </pre>
            )}
            <button onClick={this.handleReset} className="btn-primary w-full">
              Return to Dashboard
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}

// ── Full-Screen Loading Spinner ───────────────────────────────────────────────
/**
 * Shown while AuthContext is restoring the session from localStorage.
 * Prevents a flash of the login page for already-authenticated users.
 */
const AppLoadingScreen = () => (
  <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4">
    {/* Animated logo mark */}
    <div className="relative">
      <div className="w-14 h-14 rounded-2xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shadow-lg">
        <span className="text-emerald-400 text-2xl font-bold font-mono">₹</span>
      </div>
      {/* Spinning ring */}
      <div className="absolute inset-0 rounded-2xl border-2 border-emerald-500 border-t-transparent animate-spin" />
    </div>
    <p className="text-sm font-medium text-slate-400 dark:text-slate-500 animate-pulse-soft">
      Loading TrackWise…
    </p>
  </div>
);

// ── Protected Route Guard ────────────────────────────────────────────────────
/**
 * ProtectedRoute — Wraps any route that requires authentication.
 *
 * Behaviour:
 *   - While isLoading is true (session restoration in progress): show nothing
 *     (parent App shows AppLoadingScreen, so this case shouldn't flash).
 *   - If user is null (not authenticated): redirect to /login, preserving the
 *     intended destination in state so we can redirect back after login.
 *   - If user exists: render <Outlet /> (the child route's page component).
 */
const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  // Still verifying stored token — render nothing to avoid flash
  if (isLoading) return null;

  // Not authenticated — redirect to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated — render the protected layout (Navbar + page content)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Top navigation bar — rendered on every protected page */}
      <Navbar />

      {/* Main content area — individual page components render here */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 page-enter">
        <Outlet />
      </main>
    </div>
  );
};

// ── Public Route Guard ────────────────────────────────────────────────────────
/**
 * PublicRoute — Wraps login/register routes.
 * Redirects already-authenticated users away from auth pages.
 */
const PublicRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;

  // Already logged in — send to dashboard
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
};

// ── App Inner (uses hooks — must be inside providers) ─────────────────────────
const AppInner = () => {
  const { isLoading } = useAuth();

  // Show loading screen while session is being restored
  if (isLoading) return <AppLoadingScreen />;

  return (
    <Routes>
      {/* ── Root redirect ─────────────────────────────────────────────── */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      {/* ── Public Routes (redirect to dashboard if already logged in) ── */}
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* ── Protected Routes (require authentication) ───────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
      </Route>

      {/* ── 404 Fallback ────────────────────────────────────────────── */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

// ── Root App Component ────────────────────────────────────────────────────────
/**
 * App — Composes all global providers and wraps with ErrorBoundary.
 *
 * Provider order (outermost first):
 *   ThemeProvider → applies dark class to <html>
 *   BrowserRouter → enables React Router hooks
 *   AuthProvider  → JWT session management + axios headers
 *   ErrorBoundary → catches rendering errors
 */
const App = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <ErrorBoundary>
            <AppInner />
          </ErrorBoundary>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
