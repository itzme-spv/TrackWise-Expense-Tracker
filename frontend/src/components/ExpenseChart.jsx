/**
 * components/ExpenseChart.jsx
 *
 * Category Breakdown Doughnut Chart
 *
 * Uses react-chartjs-2 (wrapper around Chart.js) to render a doughnut chart
 * showing how the user's expenses are distributed across categories.
 *
 * Dark Mode Strategy:
 *   Chart.js renders to a <canvas> — Tailwind dark: classes don't apply to canvas.
 *   Instead, we read the CSS custom properties (--chart-grid, --chart-text)
 *   defined in index.css via getComputedStyle(document.documentElement).
 *   These CSS vars switch automatically when the `dark` class toggles on <html>.
 *   We re-compute them inside a useEffect that watches `isDark` from ThemeContext.
 *
 * MERN Data Flow:
 *   GET /api/transactions/summary → data.categoryBreakdown
 *   → DashboardPage state → <ExpenseChart breakdown={categoryBreakdown} />
 */

import { useEffect, useRef, useMemo } from 'react';
import { Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  DoughnutController,
} from 'chart.js';
import { useTheme } from '../context/ThemeContext';
import { PieChart } from 'lucide-react';

// Register only the Chart.js modules we need (tree-shaking)
ChartJS.register(ArcElement, Tooltip, Legend, DoughnutController);

// ── Category Colour Palette ────────────────────────────────────────────────────
// Each category has a solid colour and a translucent version for the hover state.
// Ordered to match the Transaction model's category enum.
const CATEGORY_COLORS = {
  'Housing':          { solid: '#6366f1', alpha: 'rgba(99,102,241,0.85)' },   // indigo
  'Food & Groceries': { solid: '#f59e0b', alpha: 'rgba(245,158,11,0.85)' },  // amber
  'Transport':        { solid: '#3b82f6', alpha: 'rgba(59,130,246,0.85)' },  // blue
  'Utilities':        { solid: '#8b5cf6', alpha: 'rgba(139,92,246,0.85)' },  // violet
  'Entertainment':    { solid: '#ec4899', alpha: 'rgba(236,72,153,0.85)' },  // pink
  'Healthcare':       { solid: '#10b981', alpha: 'rgba(16,185,129,0.85)' },  // emerald
  'Salary':           { solid: '#06b6d4', alpha: 'rgba(6,182,212,0.85)' },   // cyan
  'Other':            { solid: '#94a3b8', alpha: 'rgba(148,163,184,0.85)' }, // slate
};

// Fallback colour for any unlisted category
const FALLBACK_COLOR = { solid: '#64748b', alpha: 'rgba(100,116,139,0.85)' };

// ── Skeleton Loader ────────────────────────────────────────────────────────────
const ChartSkeleton = () => (
  <div className="flex flex-col items-center gap-4">
    <div className="skeleton w-48 h-48 rounded-full" />
    <div className="space-y-2 w-full">
      {[80, 65, 50, 40].map((w) => (
        <div key={w} className="flex items-center gap-2">
          <div className="skeleton w-3 h-3 rounded-full" />
          <div className={`skeleton h-3 rounded`} style={{ width: `${w}%` }} />
        </div>
      ))}
    </div>
  </div>
);

// ── Empty State ────────────────────────────────────────────────────────────────
const ChartEmpty = () => (
  <div className="flex flex-col items-center justify-center py-8 gap-3">
    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
      <PieChart size={28} className="text-slate-400 dark:text-slate-500" />
    </div>
    <div className="text-center">
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">
        No expense data yet
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        Add some expenses to see your breakdown.
      </p>
    </div>
  </div>
);

// ── Custom Legend Item ─────────────────────────────────────────────────────────
const LegendItem = ({ label, total, percentage, color }) => (
  <div className="flex items-center justify-between gap-2 py-1.5 group">
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400 truncate group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
        {label}
      </span>
    </div>
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-xs font-numeric text-slate-500 dark:text-slate-400">
        ₹{total.toLocaleString('en-IN')}
      </span>
      <span className="text-xs font-semibold font-numeric text-slate-700 dark:text-slate-300 w-10 text-right">
        {percentage}%
      </span>
    </div>
  </div>
);

// ── Main ExpenseChart Component ────────────────────────────────────────────────
/**
 * Props:
 *   breakdown {Array<{ category: string, total: number }>} — from API
 *   isLoading {boolean}
 */
const ExpenseChart = ({ breakdown = [], isLoading = false }) => {
  const { isDark } = useTheme();
  const chartRef = useRef(null);

  // ── Compute chart data from breakdown array ───────────────────────────────
  const { chartData, totalExpense, legendItems } = useMemo(() => {
    if (!breakdown || breakdown.length === 0) {
      return { chartData: null, totalExpense: 0, legendItems: [] };
    }

    const total = breakdown.reduce((sum, item) => sum + item.total, 0);

    const labels = breakdown.map((item) => item.category);
    const amounts = breakdown.map((item) => item.total);
    const colors = breakdown.map(
      (item) => (CATEGORY_COLORS[item.category] || FALLBACK_COLOR).alpha
    );
    const solidColors = breakdown.map(
      (item) => (CATEGORY_COLORS[item.category] || FALLBACK_COLOR).solid
    );

    const legend = breakdown.map((item) => ({
      label: item.category,
      total: item.total,
      percentage: total > 0 ? ((item.total / total) * 100).toFixed(1) : '0.0',
      color: (CATEGORY_COLORS[item.category] || FALLBACK_COLOR).solid,
    }));

    return {
      chartData: {
        labels,
        datasets: [
          {
            data: amounts,
            backgroundColor: colors,
            hoverBackgroundColor: solidColors,
            borderColor: 'transparent',
            borderWidth: 0,
            hoverOffset: 6,
          },
        ],
      },
      totalExpense: total,
      legendItems: legend,
    };
  }, [breakdown]);

  // ── Read CSS vars for dark/light chart text ───────────────────────────────
  // Called after every theme toggle to keep Chart.js in sync
  const getChartTextColor = () =>
    getComputedStyle(document.documentElement)
      .getPropertyValue('--chart-text')
      .trim() || '#94a3b8';

  // Force chart re-render on theme change by updating its options
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const textColor = getChartTextColor();

    chart.options.plugins.tooltip.bodyColor = textColor;
    chart.options.plugins.tooltip.titleColor = textColor;
    chart.update('none'); // 'none' = update without animation
  }, [isDark]);

  // ── Chart.js options ─────────────────────────────────────────────────────
  const chartOptions = useMemo(() => {
    const textColor = getChartTextColor();

    return {
      responsive: true,
      maintainAspectRatio: true,
      cutout: '68%', // Controls the doughnut hole size

      plugins: {
        // Hide default Chart.js legend — we render our own custom legend below
        legend: { display: false },

        tooltip: {
          // Dark mode-aware tooltip
          backgroundColor: isDark ? '#1e293b' : '#0f172a',
          titleColor: '#f1f5f9',
          bodyColor: textColor,
          borderColor: isDark ? '#334155' : '#1e293b',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 10,
          titleFont: { family: 'Sora', size: 12, weight: '600' },
          bodyFont: { family: 'JetBrains Mono', size: 12 },

          callbacks: {
            // Format: "₹12,500 (34.5%)"
            label: (context) => {
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
              return `  ₹${value.toLocaleString('en-IN')}  (${pct}%)`;
            },
          },
        },
      },

      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 500,
        easing: 'easeOutQuart',
      },
    };
  }, [isDark]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (isLoading) return <ChartSkeleton />;
  if (!chartData) return <ChartEmpty />;

  return (
    <div className="flex flex-col gap-5">
      {/* Doughnut chart with centred total */}
      <div className="relative flex items-center justify-center">
        <div className="w-48 h-48">
          <Doughnut
            ref={chartRef}
            data={chartData}
            options={chartOptions}
            aria-label="Expense category breakdown doughnut chart"
            role="img"
          />
        </div>

        {/* Centre label — total spend overlaid in the doughnut hole */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            Total
          </span>
          <span className="font-numeric text-lg font-semibold text-slate-800 dark:text-slate-100 leading-tight">
            ₹{totalExpense.toLocaleString('en-IN')}
          </span>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
        {legendItems.map((item) => (
          <LegendItem key={item.label} {...item} />
        ))}
      </div>
    </div>
  );
};

export default ExpenseChart;
