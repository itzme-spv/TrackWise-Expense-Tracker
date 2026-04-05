/**
 * context/ThemeContext.jsx
 *
 * Dark / Light Mode Theme Context
 *
 * Strategy: Tailwind's `darkMode: 'class'` — we add/remove the `dark`
 * class on the <html> element. Tailwind's dark: prefix classes activate
 * automatically. CSS variables in index.css also update via the .dark selector.
 *
 * Persistence: User's theme preference is saved to localStorage so it
 * survives page refreshes.
 *
 * Usage:
 *   const { isDark, toggleTheme } = useTheme();
 */

import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  // Initialise from localStorage, or detect the system preference as the default
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem('expenseTheme');
    if (stored) return stored === 'dark';

    // System preference detection — respect OS dark mode by default
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // ── Sync `dark` class to <html> whenever isDark changes ──────────────────
  useEffect(() => {
    const root = document.documentElement; // The <html> element
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    // Persist preference
    localStorage.setItem('expenseTheme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => setIsDark((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme() must be used inside a <ThemeProvider>.');
  }
  return context;
};

export default ThemeContext;
