/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand Colors from Style Guide
        'energy-orange': '#FE4401',
        'stage-black': '#121212',
        'electric-yellow': '#FFD400',
        'smoke-white': '#F5F5F5',
        'amp-red': '#D7263D',
        'steel-gray': '#2E2E2E',

        // Semantic Aliases
        primary: '#FE4401',
        secondary: '#FFD400',
        danger: '#D7263D',
        background: '#121212',
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
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

