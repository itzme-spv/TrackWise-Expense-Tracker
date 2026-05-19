/**
 * pages/ReportsPage.jsx
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, LineElement, PointElement,
  ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  BarChart2, TrendingUp, TrendingDown,
  PiggyBank, RefreshCw, Calendar,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Filler, Tooltip, Legend);

const PALETTE = {
  income:  { solid: 'rgba(16,185,129,0.85)',  hover: '#10b981' },
  expense: { solid: 'rgba(244,63,94,0.75)',   hover: '#f43f5e' },
  savings: { solid: 'rgba(59,130,246,0.15)',  border: '#3b82f6' },
};

const CATEGORY_COLORS = {
  'Housing': '#6366f1', 'Food & Groceries': '#f59e0b', 'Transport': '#3b82f6',
  'Utilities': '#8b5cf6', 'Entertainment': '#ec4899', 'Healthcare': '#10b981',
  'Salary': '#06b6d4', 'Other': '#94a3b8',
};

const fmtINR = (n) => `₹${(n||0).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
const getChartText = () => getComputedStyle(document.documentElement).getPropertyValue('--chart-text').trim() || '#94a3b8';
const getChartGrid = () => getComputedStyle(document.documentElement).getPropertyValue('--chart-grid').trim() || '#f1f5f9';

const Pill = ({ label, value, icon: Icon, colorClass, isLoading }) => (
  <article className="card flex items-center gap-3 py-4">
    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
      <Icon size={16} aria-hidden="true" />
    </div>
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">{label}</p>
      {isLoading ? <div className="skeleton h-6 w-24 mt-0.5 rounded" /> : <p className="font-numeric text-base font-bold text-slate-800 dark:text-slate-100 truncate">{value}</p>}
    </div>
  </article>
);

const CategoryRow = ({ category, total, percentage, rank }) => {
  const color = CATEGORY_COLORS[category] || '#94a3b8';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 w-4">#{rank}</span>
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
          <span className="font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]">{category}</span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="font-numeric text-xs text-slate-500 dark:text-slate-400">{fmtINR(total)}</span>
          <span className="font-numeric text-xs font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{percentage}%</span>
        </div>
      </div>
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full progress-bar-fill transition-all duration-700" style={{ '--progress-width': `${Math.min(100, percentage)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const ChartSkeleton = ({ height = 260 }) => (
  <div className="flex flex-col gap-3"><div className="skeleton w-full rounded-xl" style={{ height }} /></div>
);

const ReportsPage = () => {
  const { isDark }  = useTheme();
  const { toast }   = useToast();
  const barRef      = useRef(null);
  const lineRef     = useRef(null);

  const [months, setMonths]       = useState(6);
  const [trend,  setTrend]        = useState([]);
  const [summary, setSummary]     = useState(null);
  const [loading, setLoading]     = useState(true);

  // ── Fetch both endpoints in parallel (✦ Fixed to Sync Exact Calendar Months) ──
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const d = new Date();
      // End of the current month
      const toStr = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString().split('T')[0];
      // 1st day of the starting month (e.g., if months=3 and it's April, get Feb 1st)
      const fromStr = new Date(d.getFullYear(), d.getMonth() - months + 1, 1).toISOString().split('T')[0];

      const [trendRes, summaryRes] = await Promise.all([
        axios.get(`/api/transactions/monthly?months=${months}`),
        // Pass the explicit date window for category breakdowns
        axios.get(`/api/transactions/summary?from=${fromStr}&to=${toStr}`), 
      ]);
      if (trendRes.data.success)   setTrend(trendRes.data.data);
      if (summaryRes.data.success) setSummary(summaryRes.data.data);
    } catch (e) {
      toast.error('Failed to load report data.', 'Error');
    } finally {
      setLoading(false);
    }
  }, [months, toast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    [barRef, lineRef].forEach(ref => { if (ref.current) ref.current.update('none'); });
  }, [isDark]);

  // ── ✦ FIX: Calculate totals directly from the Trend Chart Data to guarantee sync ──
  const totalIncome  = useMemo(() => trend.reduce((sum, item) => sum + (item.income || 0), 0), [trend]);
  const totalExpense = useMemo(() => trend.reduce((sum, item) => sum + (item.expense || 0), 0), [trend]);
  const savingsRate  = totalIncome > 0 ? Math.max(0, ((totalIncome - totalExpense) / totalIncome * 100)).toFixed(1) : '0.0';

  const top5 = useMemo(() => {
    const bd = summary?.categoryBreakdown || [];
    return [...bd].sort((a, b) => b.total - a.total).slice(0, 5).map(item => ({
        ...item,
        percentage: totalExpense > 0 ? parseFloat(((item.total / totalExpense) * 100).toFixed(1)) : 0,
      }));
  }, [summary, totalExpense]);

  const sharedOptions = useMemo(() => {
    const text = getChartText();
    const grid = getChartGrid();
    return {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: text, font: { family: 'Sora', size: 11, weight: '600' }, boxWidth: 12, boxHeight: 12, borderRadius: 4 } },
        tooltip: {
          backgroundColor: isDark ? '#1e293b' : '#0f172a', titleColor: '#f1f5f9', bodyColor: text,
          borderColor: isDark ? '#334155' : '#1e293b', borderWidth: 1, padding: 12, cornerRadius: 10,
          titleFont: { family: 'Sora', size: 12, weight: '600' }, bodyFont: { family: 'JetBrains Mono', size: 12 },
          callbacks: { label: ctx => `  ${ctx.dataset.label}: ₹${ctx.parsed.y.toLocaleString('en-IN')}` },
        },
      },
      scales: {
        x: { ticks: { color: text, font: { family: 'Sora', size: 10 } }, grid: { color: grid } },
        y: { ticks: { color: text, font: { family: 'JetBrains Mono', size: 10 }, callback: v => `₹${(v/1000).toFixed(0)}k` }, grid: { color: grid }, beginAtZero: true },
      },
      animation: { duration: 400, easing: 'easeOutQuart' },
    };
  }, [isDark]);

  const barData = useMemo(() => ({
    labels: trend.map(t => t.month),
    datasets: [
      { label: 'Income', data: trend.map(t => t.income), backgroundColor: PALETTE.income.solid, hoverBackgroundColor: PALETTE.income.hover, borderRadius: 6, borderSkipped: false },
      { label: 'Expense', data: trend.map(t => t.expense), backgroundColor: PALETTE.expense.solid, hoverBackgroundColor: PALETTE.expense.hover, borderRadius: 6, borderSkipped: false },
    ],
  }), [trend]);

  const lineData = useMemo(() => ({
    labels: trend.map(t => t.month),
    datasets: [
      { label: 'Income', data: trend.map(t => t.income), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.08)', pointBackgroundColor: '#10b981', pointRadius: 4, pointHoverRadius: 6, fill: false, tension: 0.35 },
      { label: 'Expense', data: trend.map(t => t.expense), borderColor: '#f43f5e', backgroundColor: 'rgba(244,63,94,0.08)', pointBackgroundColor: '#f43f5e', pointRadius: 4, pointHoverRadius: 6, fill: false, tension: 0.35 },
      { label: 'Savings', data: trend.map(t => Math.max(0, t.savings)), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.10)', pointBackgroundColor: '#3b82f6', pointRadius: 3, pointHoverRadius: 5, fill: true, tension: 0.35, borderDash: [5, 3] },
    ],
  }), [trend]);

  return (
    <>
      <header className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-slate-700 flex items-center justify-center shadow-md flex-shrink-0">
            <BarChart2 size={18} className="text-emerald-400" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Reports & Analytics</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Month-over-month trends and spending breakdown.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1" role="group" aria-label="Select time range">
            {[3, 6, 12].map(m => (
              <button key={m} onClick={() => setMonths(m)}
                className={['px-3 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200', months === m ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'].join(' ')}
                aria-pressed={months === m}>
                {m}M
              </button>
            ))}
          </div>
          <button onClick={fetchData} disabled={loading} className="btn-ghost p-2" aria-label="Refresh data">
            <RefreshCw size={16} className={loading ? 'animate-spin text-emerald-500' : 'text-slate-400'} />
          </button>
        </div>
      </header>

      <section aria-label="Period summary" className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Pill label={`Total Income (${months}M)`}  value={fmtINR(totalIncome)}  icon={TrendingUp}   colorClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500" isLoading={loading} />
        <Pill label={`Total Expenses (${months}M)`} value={fmtINR(totalExpense)} icon={TrendingDown}  colorClass="bg-rose-100 dark:bg-rose-900/30 text-rose-500"         isLoading={loading} />
        <Pill label="Savings Rate"                  value={`${savingsRate}%`}    icon={PiggyBank}     colorClass="bg-blue-100 dark:bg-blue-900/30 text-blue-500"          isLoading={loading} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <article className="card">
          <header className="flex items-center gap-2 mb-5">
            <BarChart2 size={15} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <h2 className="section-title">Income vs Expenses</h2>
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1"><Calendar size={11} />{months} months</span>
          </header>
          {loading ? <ChartSkeleton height={260} /> : trend.length === 0 ? <p className="text-sm text-slate-400 text-center py-16">No data for this period.</p> : (
              <div style={{ height: 260 }}><Bar ref={barRef} data={barData} options={{ ...sharedOptions, plugins: { ...sharedOptions.plugins, legend: { ...sharedOptions.plugins.legend, position: 'top' } } }} aria-label="Income vs Expense bar chart" role="img" /></div>
            )}
        </article>

        <article className="card">
          <header className="flex items-center gap-2 mb-5">
            <TrendingUp size={15} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
            <h2 className="section-title">Monthly Trend</h2>
            <span className="ml-auto text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1"><Calendar size={11} />{months} months</span>
          </header>
          {loading ? <ChartSkeleton height={260} /> : trend.length === 0 ? <p className="text-sm text-slate-400 text-center py-16">No data for this period.</p> : (
              <div style={{ height: 260 }}><Line ref={lineRef} data={lineData} options={{ ...sharedOptions, plugins: { ...sharedOptions.plugins, legend: { ...sharedOptions.plugins.legend, position: 'top' } } }} aria-label="Monthly trend line chart" role="img" /></div>
            )}
        </article>
      </div>

      <article className="card">
        <header className="flex items-center gap-2 mb-6">
          <TrendingDown size={15} className="text-slate-400 dark:text-slate-500" aria-hidden="true" />
          <h2 className="section-title">Top 5 Spending Categories</h2>
        </header>
        {loading ? <div className="space-y-4">{Array.from({length:5}).map((_,i) => <div key={i} className="skeleton h-8 w-full rounded" />)}</div> : top5.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">No expense data yet.</p> : (
              <div className="space-y-5">{top5.map((item, i) => <CategoryRow key={item.category} rank={i + 1} {...item} />)}</div>
            )}
      </article>
    </>
  );
};

export default ReportsPage;