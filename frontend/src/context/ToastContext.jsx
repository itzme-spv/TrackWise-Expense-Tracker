/**
 * context/ToastContext.jsx
 *
 * Global Toast Notification Context
 *
 * Provides the entire React tree with a `useToast()` hook that lets any
 * component fire a toast notification without prop-drilling or local state.
 *
 * Toast object shape:
 *   {
 *     id:       string,   — unique key (Date.now + random suffix)
 *     type:     'success' | 'error' | 'warning' | 'info',
 *     title:    string,   — bold headline (optional)
 *     message:  string,   — body text
 *     duration: number,   — ms before auto-dismiss (default 4000, 0 = sticky)
 *   }
 *
 * Usage from any component:
 *   const { toast } = useToast();
 *
 *   toast.success('Saved!', 'Transaction added successfully.');
 *   toast.error('Failed', err.response?.data?.message);
 *   toast.warning('Heads up', 'You are nearing your budget limit.');
 *   toast.info('Tip', 'Use the 🎤 button to dictate transactions.');
 *
 * Architecture:
 *   ToastContext holds the `toasts` array and `addToast` / `removeToast` actions.
 *   <ToastContainer /> (in App.jsx) reads the array and renders the stack.
 *   Each toast auto-dismisses after `duration` ms using a per-toast setTimeout.
 *   The timer is cleared on manual dismiss to prevent double-removal.
 *
 * MERN Data Flow:
 *   API call in component → success/error → useToast().toast.success/error()
 *   → ToastContext.addToast() → toasts[] state update
 *   → ToastContainer re-renders → animated banner appears → auto-dismissed
 */

import { createContext, useContext, useState, useCallback, useRef } from 'react';

// ── Context ────────────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ── Default durations per type (ms) ───────────────────────────────────────────
const DEFAULT_DURATIONS = {
  success: 4000,
  error:   6000,   // Errors stay longer — user needs to read them
  warning: 5000,
  info:    4000,
};

// ── Provider ───────────────────────────────────────────────────────────────────
export const ToastProvider = ({ children }) => {
  // Array of active toast objects — ToastContainer renders this list
  const [toasts, setToasts] = useState([]);

  // Keep track of auto-dismiss timers so we can clear them on manual dismiss
  // Map<id → timeoutId>
  const timers = useRef({});

  // ── removeToast ─────────────────────────────────────────────────────────────
  const removeToast = useCallback((id) => {
    // Clear the auto-dismiss timer first to prevent double-removal
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    // Filter out the toast from state — triggers re-render in ToastContainer
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── addToast ────────────────────────────────────────────────────────────────
  /**
   * Core function — adds a toast to the stack.
   *
   * @param {object} options
   * @param {'success'|'error'|'warning'|'info'} options.type
   * @param {string} options.message   — Required body text
   * @param {string} [options.title]   — Optional bold headline
   * @param {number} [options.duration] — 0 = sticky (no auto-dismiss)
   */
  const addToast = useCallback(({ type = 'info', message, title, duration }) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const resolvedDuration = duration ?? DEFAULT_DURATIONS[type] ?? 4000;

    const toast = { id, type, message, title, duration: resolvedDuration };

    setToasts((prev) => {
      // Cap at 5 simultaneous toasts — remove oldest if over limit
      const updated = [...prev, toast];
      return updated.length > 5 ? updated.slice(updated.length - 5) : updated;
    });

    // Schedule auto-dismiss (skip if duration = 0 → sticky)
    if (resolvedDuration > 0) {
      timers.current[id] = setTimeout(() => removeToast(id), resolvedDuration);
    }

    return id; // Caller can use this to manually dismiss early
  }, [removeToast]);

  // ── Convenience methods ──────────────────────────────────────────────────────
  /**
   * Shorthand API exposed via useToast():
   *   toast.success(message, title?, duration?)
   *   toast.error(message, title?, duration?)
   *   toast.warning(message, title?, duration?)
   *   toast.info(message, title?, duration?)
   *
   * Note the argument order: message first, title second — this matches
   * the most common usage where you always have a message but title is optional.
   */
  const toast = {
    success: (message, title, duration) =>
      addToast({ type: 'success', message, title, duration }),

    error: (message, title, duration) =>
      addToast({ type: 'error', message, title, duration }),

    warning: (message, title, duration) =>
      addToast({ type: 'warning', message, title, duration }),

    info: (message, title, duration) =>
      addToast({ type: 'info', message, title, duration }),

    // Raw access for custom config
    add: addToast,
    dismiss: removeToast,
  };

  return (
    <ToastContext.Provider value={{ toasts, toast, removeToast, addToast }}>
      {children}
    </ToastContext.Provider>
  );
};

// ── Custom Hook ────────────────────────────────────────────────────────────────
/**
 * useToast() — consume the ToastContext from any component.
 *
 * Returns: { toast, toasts, removeToast }
 *
 * Example:
 *   const { toast } = useToast();
 *   toast.success('Transaction saved!');
 *   toast.error('Something went wrong.', 'API Error');
 */
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error(
      'useToast() must be used inside a <ToastProvider>. ' +
      'Make sure <ToastProvider> wraps your component tree in App.jsx.'
    );
  }
  return context;
};

export default ToastContext;