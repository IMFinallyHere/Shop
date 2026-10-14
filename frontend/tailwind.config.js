import defaultTheme from 'tailwindcss/defaultTheme'
import colors from 'tailwindcss/colors'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        // Public site headlines only (loaded by the landing page).
        display: ['"Bricolage Grotesque"', 'Inter', ...defaultTheme.fontFamily.sans],
      },
      colors: {
        // Single accent used across the app; swap here to rebrand.
        brand: colors.indigo,
        // Public site: indigo dye, marigold, cool cotton.
        dye: { 950: '#120F33', 900: '#1A1650', 800: '#262070', 700: '#3A3396' },
        marigold: { 200: '#FFE3A8', 300: '#FFD27A', 400: '#FDBA4D', 500: '#F59E0B', 600: '#C77A06' },
        mist: '#EEF0F6',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        pop: '0 8px 24px -6px rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.06)',
      },
      keyframes: {
        'fade-in': { from: { opacity: 0 }, to: { opacity: 1 } },
        'pop-in': { from: { opacity: 0, transform: 'translateY(4px) scale(.98)' }, to: { opacity: 1, transform: 'none' } },
        flash: { from: { backgroundColor: 'rgb(220 252 231)' }, to: { backgroundColor: 'transparent' } },
      },
      animation: {
        'fade-in': 'fade-in .15s ease-out',
        'pop-in': 'pop-in .15s ease-out',
        flash: 'flash 1.2s ease-out',
      },
    },
  },
  plugins: [],
}
