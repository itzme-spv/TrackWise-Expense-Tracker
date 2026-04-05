/**
 * components/SmartInsights.jsx
 *
 * Smart Spending Insights Banner Component
 *
 * Receives an `insights` array from DashboardPage (fetched from GET /api/transactions/insights)
 * and maps over it to render styled alert banners.
 *
 * Each insight object shape: { type: 'warning' | 'success' | 'danger', code: string, message: string }
 *
 * Banner types map to CSS classes defined in index.css:
 *   'warning' → .alert-warning  (amber)
 *   'success' → .alert-success  (emerald)
 *   'danger'  → .alert-danger   (rose)
 *
 * MERN Data Flow:
 *   GET /api/transactions/insights → DashboardPage state → <SmartInsights insights={...} />
 */

import { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  X,
  Lightbulb,
  TrendingUp,
  ShoppingCart,
  Flame,
} from 'lucide-react';

// ── Icon & class maps keyed on insight type ───────────────────────────────────
const TYPE_CONFIG = {
  warning: {
    className: 'alert-warning',
    Icon: AlertTriangle,
    iconClass: 'text-amber-500 dark:text-amber-400 flex-shrink-0 mt-0.5',
    dismissHover: 'hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-600 dark:text-amber-400',
  },
  success: {
    className: 'alert-success',
    Icon: CheckCircle2,
    iconClass: 'text-emerald-500 dark:text-emerald-400 flex-shrink-0 mt-0.5',
    dismissHover: 'hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400',
  },
  danger: {
    className: 'alert-danger',
    Icon: AlertOctagon,
    iconClass: 'text-rose-500 dark:text-rose-400 flex-shrink-0 mt-0.5',
    dismissHover: 'hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400',
  },
};

// ── Optional code-specific secondary icons ─────────────────────────────────────
const CODE_ICON = {
  FOOD_OVERSPEND: ShoppingCart,
  GOOD_SAVINGS: TrendingUp,
  BUDGET_EXCEEDED: Flame,
};

// ── Single Banner ──────────────────────────────────────────────────────────────
const InsightBanner = ({ insight, onDismiss }) => {
  const config = TYPE_CONFIG[insight.type] || TYPE_CONFIG.warning;
  const { className, Icon, iconClass, dismissHover } = config;
  const SecondaryIcon = CODE_ICON[insight.code];

  return (
    // Uses .alert-warning / .alert-success / .alert-danger from index.css
    // which include animate-slide-down for smooth entrance
    <article className={className} role="alert" aria-live="polite">
      {/* Primary type icon */}
      <Icon size={18} className={iconClass} aria-hidden="true" />

      {/* Message content */}
      <div className="flex-1 min-w-0">
        <p className="leading-snug">{insight.message}</p>

        {/* Optional code-specific secondary icon badge */}
        {SecondaryIcon && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <SecondaryIcon size={12} className="opacity-60" aria-hidden="true" />
            <span className="text-xs font-normal opacity-70 uppercase tracking-wider">
              {insight.code.replace(/_/g, ' ').toLowerCase()}
            </span>
          </div>
        )}
      </div>

      {/* Dismiss button — removes this banner from local state */}
      <button
        onClick={() => onDismiss(insight.code)}
        className={`p-1 rounded-lg transition-colors duration-150 ${dismissHover} flex-shrink-0`}
        aria-label={`Dismiss ${insight.type} insight`}
        title="Dismiss"
      >
        <X size={14} />
      </button>
    </article>
  );
};

// ── Skeleton loader while insights are fetching ────────────────────────────────
const InsightSkeleton = () => (
  <div className="space-y-2">
    <div className="skeleton h-14 w-full" />
    <div className="skeleton h-14 w-4/5" />
  </div>
);

// ── Empty state when no insights ───────────────────────────────────────────────
const InsightEmpty = () => (
  <article className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
    <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
      <Lightbulb size={16} className="text-emerald-500" aria-hidden="true" />
    </div>
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        All clear — no spending alerts
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
        Add transactions to see personalised insights here.
      </p>
    </div>
  </article>
);

// ── Main SmartInsights Component ───────────────────────────────────────────────
/**
 * Props:
 *   insights  {Array}   — Array of insight objects from the API
 *   isLoading {boolean} — Show skeleton while fetching
 */
const SmartInsights = ({ insights = [], isLoading = false }) => {
  // Track which banners have been dismissed by the user (by insight.code)
  // Dismissed banners are hidden from the UI until the next data refresh
  const [dismissed, setDismissed] = useState(new Set());

  const handleDismiss = (code) => {
    setDismissed((prev) => new Set([...prev, code]));
  };

  // Filter out dismissed insights
  const visibleInsights = insights.filter((i) => !dismissed.has(i.code));

  return (
    // <section> with semantic role — required by blueprint's HTML5 spec
    <section aria-label="Smart spending insights">
      {isLoading ? (
        <InsightSkeleton />
      ) : visibleInsights.length === 0 ? (
        <InsightEmpty />
      ) : (
        <div className="space-y-2">
          {visibleInsights.map((insight) => (
            <InsightBanner
              key={insight.code}
              insight={insight}
              onDismiss={handleDismiss}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default SmartInsights;
