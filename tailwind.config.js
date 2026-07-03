/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Design tokens (mobile-redesign-port) — channel vars in index.css.
        // rgb(var(--x-rgb) / <alpha-value>) so utilities AND /opacity modifiers work. ──
        // Surfaces
        'bg-0': 'rgb(var(--bg-0-rgb) / <alpha-value>)',
        'bg-1': 'rgb(var(--bg-1-rgb) / <alpha-value>)',
        'bg-2': 'rgb(var(--bg-2-rgb) / <alpha-value>)',
        'bg-3': 'rgb(var(--bg-3-rgb) / <alpha-value>)',
        'bg-4': 'rgb(var(--bg-4-rgb) / <alpha-value>)',
        'border-1': 'rgb(var(--border-1-rgb) / <alpha-value>)',
        'border-2': 'rgb(var(--border-2-rgb) / <alpha-value>)',
        // Ink ramp
        'ink-1': 'rgb(var(--ink-1-rgb) / <alpha-value>)',
        'ink-2': 'rgb(var(--ink-2-rgb) / <alpha-value>)',
        'ink-3': 'rgb(var(--ink-3-rgb) / <alpha-value>)',
        'ink-4': 'rgb(var(--ink-4-rgb) / <alpha-value>)',
        'ink-5': 'rgb(var(--ink-5-rgb) / <alpha-value>)',
        'ink-6': 'rgb(var(--ink-6-rgb) / <alpha-value>)',
        // Accent (unified) + semantic
        accent: 'rgb(var(--accent-rgb) / <alpha-value>)',
        'accent-soft': 'var(--accent-soft)',
        'accent-line': 'var(--accent-line)',
        info: 'rgb(var(--info-rgb) / <alpha-value>)',
        success: 'rgb(var(--success-rgb) / <alpha-value>)',
        warn: 'rgb(var(--warn-rgb) / <alpha-value>)',

        // Legacy brand aliases — point at the unified accent / token surfaces so the
        // ~65 arbitrary-hex files migrate cleanly and the two oranges collapse to one.
        'energy-orange': 'rgb(var(--accent-rgb) / <alpha-value>)',
        'stage-black': 'rgb(var(--bg-1-rgb) / <alpha-value>)',
        'electric-yellow': '#FFD400',
        'smoke-white': '#F5F5F5',
        'amp-red': 'rgb(var(--danger-rgb) / <alpha-value>)',
        'steel-gray': '#2E2E2E',

        // Semantic Aliases
        primary: 'rgb(var(--accent-rgb) / <alpha-value>)',
        secondary: '#FFD400',
        danger: 'rgb(var(--danger-rgb) / <alpha-value>)',
        background: 'rgb(var(--bg-1-rgb) / <alpha-value>)',
        surface: '#F5F5F5',
        text: '#2E2E2E',

        // Keep existing confidence colors
        confidence: {
          1: '#ef4444',
          2: '#f97316',
          3: '#eab308',
          4: '#22c55e',
          5: '#10b981',
        }
      },
      spacing: {
        'touch': '44px', // iOS minimum touch target
        'touch-lg': '56px', // Comfortable touch target
      },
      screens: {
        'xs': '320px',
      },
      fontFamily: {
        sans: ['Geist', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        'slide-down': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        'toast-progress': {
          '0%': { width: '100%' },
          '100%': { width: '0%' },
        },
      },
      animation: {
        'slide-down': 'slide-down 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'toast-progress': 'toast-progress 4s linear',
      },
    },
  },
  plugins: [],
}

