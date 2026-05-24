/**
 * main.jsx — React 18 Application Entry Point
 *
 * This is the very first JavaScript file executed by Vite when the browser
 * loads the app. Its sole responsibility is to mount the root <App /> component
 * into the #root <div> defined in index.html.
 *
 * React 18 uses createRoot() instead of the legacy ReactDOM.render() —
 * this enables Concurrent Mode features like automatic batching, Suspense
 * improvements, and the useTransition hook.
 *
 * StrictMode:
 * Wrapping the app in <StrictMode> causes React to:
 * - Double-invoke certain lifecycle functions in development to surface
 * side effects in useEffect / useState initialisers
 * - Warn about deprecated API usage
 * - Detect unexpected state mutations
 * StrictMode renders are development-only — no impact on production builds.
 *
 * Global Unhandled Error Listeners:
 * The ErrorBoundary in App.jsx catches errors that occur during React rendering.
 * However, it cannot catch:
 * - Asynchronous errors (e.g., in setTimeout callbacks)
 * - Unhandled Promise rejections (e.g., a forgotten .catch())
 * We add window event listeners here to log those to the console in
 * development, preventing silent failures during the viva review.
 *
 * MERN Data Flow starting point:
 * index.html → main.jsx → App.jsx → ThemeProvider → BrowserRouter
 * → AuthProvider (restores JWT session) → routes → pages → API calls
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// ✦ Phase 4 Auth Upgrade: Import the Google OAuth Provider
import { GoogleOAuthProvider } from '@react-oauth/google';

// Global styles: Tailwind directives + CSS variables + component classes
import './index.css';

import App from './App.jsx';

// ── Global async error logging (development only) ─────────────────────────────
// These listeners catch errors that React's ErrorBoundary cannot intercept.
if (import.meta.env.DEV) {
  /**
   * Catches uncaught synchronous errors thrown outside of React's render cycle
   * (e.g., inside a vanilla JS setTimeout or an event listener attached
   * directly to window).
   */
  window.addEventListener('error', (event) => {
    console.error(
      '[TrackWise] Uncaught global error:',
      event.message,
      '\nSource:', event.filename,
      '\nLine:', event.lineno
    );
  });

  /**
   * Catches unhandled Promise rejections — the most common source of
   * silent failures in async/await code where .catch() is omitted.
   *
   * Example that this catches:
   * axios.get('/api/some-route'); // Missing await AND missing .catch()
   */
  window.addEventListener('unhandledrejection', (event) => {
    console.error(
      '[TrackWise] Unhandled Promise rejection:',
      event.reason
    );
  });
}

// ── Mount React application ───────────────────────────────────────────────────
/**
 * document.getElementById('root') targets the <div id="root"> in index.html.
 * createRoot() prepares the DOM node for React 18's concurrent rendering.
 * .render() kicks off the component tree: App → providers → router → pages.
 */
const rootElement = document.getElementById('root');

if (!rootElement) {
  // Safety guard — should never happen, but gives a clear message if index.html
  // is misconfigured (e.g., the #root div was accidentally renamed).
  throw new Error(
    '[TrackWise] Could not find #root element in index.html. ' +
    'Make sure <div id="root"></div> exists in the <body>.'
  );
}

createRoot(rootElement).render(
  <StrictMode>
    {/* ✦ Phase 4 Auth Upgrade: Wrap the entire app to enable Google Sign-In */}
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>
);