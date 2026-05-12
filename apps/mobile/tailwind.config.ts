import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: { 950: '#04060c', 900: '#070a13', 800: '#0b0f1a', 700: '#121829', 600: '#1a2236' },
        neon: { cyan: '#46e6ff', pink: '#ff4d8d', lime: '#a6ff4d', violet: '#8b6cff' },
      },
      boxShadow: {
        glow: '0 0 28px rgba(70,230,255,0.28)',
        'glow-pink': '0 0 28px rgba(255,77,141,0.3)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
