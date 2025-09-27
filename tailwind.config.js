/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
        confidence: {
          1: '#ef4444', // red-500
          2: '#f97316', // orange-500
          3: '#eab308', // yellow-500
          4: '#22c55e', // green-500
          5: '#10b981', // emerald-500
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
      }
    },
  },
  plugins: [],
}

