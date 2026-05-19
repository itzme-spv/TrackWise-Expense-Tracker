/**
 * components/ToastContainer.jsx
 *
 * Animated Toast Notification Renderer
 *
 * Reads the `toasts` array from ToastContext and renders each one as a
 * slide-in card anchored to the bottom-right corner of the viewport.
 * The container is rendered once in App.jsx above all routes so it's
 * always visible regardless of which page is active.
 *
 * Visual Anatomy of a Toast:
 *   ┌──────────────────────────────────────────────┐
 *   │  [Icon]  Title (bold)             [× dismiss]│
 *   │          Message body text                   │
 *   │  ████████████░░░░░░░ progress bar            │
 *   └──────────────────────────────────────────────┘
 *
 * Type → colour mapping (matches index.css design tokens):
 *   success → emerald
 *   error   → rose
 *   warning → amber
 *   info    → blue
 *
 * Animation Strategy:
 *   - Entry: CSS translate + opacity transition (slide up from bottom-right)
 *   - Exit:  Same transition in reverse via the `removing` class
 *   - The progress bar depletes over `duration` ms using a CSS animation
 *     driven by a CSS variable `--toast-duration` set as an inline style.
 *   - All transitions are CSS-only — no animation library needed.
 *
 * Accessibility:
 *   - role="status" + aria-live="polite" for success/info
 *   - role="alert"  + aria-live="assertive" for error/warning
 *   - Each toast has a visible dismiss button with aria-label
 *   - Focus is NOT moved to the toast (would be disruptive mid-form)
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
} from 'lucide-react';
import { useToast } from '../context/ToastContext';

// ── Type Configuration Map ─────────────────────────────────────────────────────
const TYPE_CONFIG = {
  success: {
    Icon:         CheckCircle2,
    iconClass:    'text-emerald-500',
    borderClass:  'border-l-emerald-500',
    bgClass:      'bg-white dark:bg-slate-800',
    titleClass:   'text-emerald-700 dark:text-emerald-400',
    barClass:     'bg-emerald-500',
    ariaRole:     'status',
    ariaLive:     'polite',
  },
  error: {
    Icon:         XCircle,
    iconClass:    'text-rose-500',
    borderClass:  'border-l-rose-500',
    bgClass:      'bg-white dark:bg-slate-800',
    titleClass:   'text-rose-700 dark:text-rose-400',
    barClass:     'bg-rose-500',
    ariaRole:     'alert',
    ariaLive:     'assertive',
  },
  warning: {
    Icon:         AlertTriangle,
    iconClass:    'text-amber-500',
    borderClass:  'border-l-amber-500',
    bgClass:      'bg-white dark:bg-slate-800',
    titleClass:   'text-amber-700 dark:text-amber-400',
    barClass:     'bg-amber-500',
    ariaRole:     'alert',
    ariaLive:     'assertive',
  },
  info: {
    Icon:         Info,
    iconClass:    'text-blue-500',
    borderClass:  'border-l-blue-500',
    bgClass:      'bg-white dark:bg-slate-800',
    titleClass:   'text-blue-700 dark:text-blue-400',
    barClass:     'bg-blue-500',
    ariaRole:     'status',
    ariaLive:     'polite',
  },
};

// ── Progress Bar ───────────────────────────────────────────────────────────────
/**
 * A thin bar at the bottom of the toast that depletes over `duration` ms.
 * Implemented as a CSS animation: width goes from 100% → 0 over the duration.
 * `--toast-duration` is a CSS variable set as an inline style.
 *
 * We inject the keyframe once via a <style> tag in the component tree.
 */
const ProgressBar = ({ duration, colorClass }) => {
  if (!duration || duration === 0) return null; // Sticky toasts have no bar

  return (
    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-100 dark:bg-slate-700 overflow-hidden rounded-b-xl">
      <div
        className={`h-full ${colorClass} origin-left`}
        style={{
          animation: `toast-deplete ${duration}ms linear forwards`,
        }}
        aria-hidden="true"
      />
    </div>
  );
};

// Inject the keyframe once (appended to <head> on first mount)
const injectToastKeyframe = (() => {
  let injected = false;
  return () => {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes toast-deplete {
        from { transform: scaleX(1); }
        to   { transform: scaleX(0); }
      }
      @keyframes toast-slide-in {
        from { opacity: 0; transform: translateY(12px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)    scale(1);    }
      }
      @keyframes toast-slide-out {
        from { opacity: 1; transform: translateY(0)    scale(1);    max-height: 200px; margin-bottom: 0.5rem; }
        to   { opacity: 0; transform: translateY(8px)  scale(0.97); max-height: 0;     margin-bottom: 0;     }
      }
      .toast-enter { animation: toast-slide-in  0.28s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
      .toast-exit  { animation: toast-slide-out 0.22s ease-in forwards; }
    `;
    document.head.appendChild(style);
  };
})();

// ── Single Toast Card ─────────────────────────────────────────────────────────
const ToastCard = ({ toast, onRemove }) => {
  const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.info;
  const { Icon, iconClass, borderClass, bgClass, titleClass, barClass, ariaRole, ariaLive } = config;

  // Track whether this toast is in its exit animation phase
  const [isExiting, setIsExiting] = useState(false);

  // Trigger the slide-out animation, then actually remove from DOM
  const handleDismiss = () => {
    setIsExiting(true);
    // Wait for the CSS exit animation to finish before removing from context
    setTimeout(() => onRemove(toast.id), 210);
  };

  return (
    <div
      role={ariaRole}
      aria-live={ariaLive}
      aria-atomic="true"
      className={[
        // Layout
        'relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden',
        // Shape & border
        `rounded-xl border border-l-4 ${borderClass}`,
        'border-slate-200 dark:border-slate-700',
        // Background & shadow
        `${bgClass} shadow-card-hover`,
        // Padding
        'px-4 py-3.5',
        // Animation class
        isExiting ? 'toast-exit' : 'toast-enter',
      ].join(' ')}
    >
      {/* Content row */}
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <Icon
          size={18}
          className={`${iconClass} flex-shrink-0 mt-0.5`}
          aria-hidden="true"
        />

        {/* Text content */}
        <div className="flex-1 min-w-0 pr-2">
          {toast.title && (
            <p className={`text-sm font-bold leading-tight mb-0.5 ${titleClass}`}>
              {toast.title}
            </p>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
            {toast.message}
          </p>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          aria-label="Dismiss notification"
          className="flex-shrink-0 -mt-0.5 -mr-1 p-1.5 rounded-lg
                     text-slate-400 dark:text-slate-500
                     hover:text-slate-600 dark:hover:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-700
                     transition-colors duration-150
                     focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          <X size={14} />
        </button>
      </div>

      {/* Depleting progress bar */}
      <ProgressBar duration={toast.duration} colorClass={barClass} />
    </div>
  );
};

// ── Toast Container ────────────────────────────────────────────────────────────
/**
 * Rendered once in App.jsx above all routes.
 * Uses React.createPortal to mount the stack directly to <body> so it
 * floats above all z-index stacking contexts (modals, navbars, etc.).
 *
 * Stack position: bottom-right on desktop, bottom-full-width on mobile.
 * Newest toasts appear at the bottom of the stack.
 */
const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  // Inject CSS keyframes once on first render
  const keyframesInjected = useRef(false);
  useEffect(() => {
    if (!keyframesInjected.current) {
      injectToastKeyframe();
      keyframesInjected.current = true;
    }
  }, []);

  if (toasts.length === 0) return null;

  return createPortal(
    // Fixed position stack — bottom-right, above everything (z-[9999])
    <div
      className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2 items-end"
      aria-label="Notifications"
      // Prevent clicks on the container from bubbling
      onClick={(e) => e.stopPropagation()}
    >
      {toasts.map((toast) => (
        <ToastCard
          key={toast.id}
          toast={toast}
          onRemove={removeToast}
        />
      ))}
    </div>,
    document.body
  );
};

export default ToastContainer;