/** @type {import('tailwindcss').Config} */
export default {
  // ── Dark Mode Strategy ──────────────────────────────────────────────────────
  // "class" strategy: dark mode is toggled by adding/removing the `dark` class
  // on the <html> element — giving us full programmatic control via the
  // ThemeToggle button in the Navbar. Tailwind then activates all `dark:` prefixed
  // utility classes automatically.
  darkMode: 'class',

  // ── Content Paths ───────────────────────────────────────────────────────────
  // Tailwind scans these files to tree-shake unused utility classes in production.
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],

  theme: {
    extend: {
      // ── Custom Font Family ────────────────────────────────────────────────
      // "Sora" — a geometric, modern sans-serif perfect for FinTech dashboards.
      // Sharp, confident, and highly legible at both display and body sizes.
      // Loaded via Google Fonts in index.html.
      fontFamily: {
        sans: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },

      // ── Extended Color Palette ────────────────────────────────────────────
      // Custom tokens that extend Tailwind's default palette.
      // These map directly to the design system in the blueprint.
      colors: {
        // Brand navy — richer than default slate-900 for the navbar/sidebar
        navy: {
          DEFAULT: '#0f172a',
          light: '#1e293b',
          subtle: '#334155',
        },
        // Accent — vibrant teal-emerald that pops against navy
        accent: {
          DEFAULT: '#10b981',  // emerald-500 equivalent
          light: '#d1fae5',    // emerald-100
          dark: '#059669',     // emerald-600
        },
        // Soft canvas background for the main area
        canvas: {
          light: '#f8fafc',    // slate-50
          dark: '#0f172a',     // slate-900
        },
      },

      // ── Box Shadows ───────────────────────────────────────────────────────
      // Layered shadows for cards — subtle depth without harshness
      boxShadow: {
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 4px 16px -2px rgb(0 0 0 / 0.08)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 12px 32px -4px rgb(0 0 0 / 0.12)',
        'glow-emerald': '0 0 24px -4px rgb(16 185 129 / 0.35)',
      },

      // ── Border Radius ─────────────────────────────────────────────────────
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },

      // ── Keyframe Animations ───────────────────────────────────────────────
      // Custom animations for the budget progress bar and alert banners
      keyframes: {
        'slide-down': {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'progress-fill': {
          '0%': { width: '0%' },
          '100%': { width: 'var(--progress-width)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },

      animation: {
        'slide-down': 'slide-down 0.25s ease-out',
        'fade-in': 'fade-in 0.3s ease-out',
        'progress-fill': 'progress-fill 0.6s ease-out forwards',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.8s linear infinite',
      },

      // ── Transition Timing ─────────────────────────────────────────────────
      transitionDuration: {
        '400': '400ms',
      },

      // ── Custom Spacing ────────────────────────────────────────────────────
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
    },
  },

  plugins: [],
};
