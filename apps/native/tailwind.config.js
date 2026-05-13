/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Soft teal accent on warm off-white — matches the web/mobile palette.
        background: '#F7F5F0',
        foreground: '#152025',
        card: '#FFFFFF',
        'card-foreground': '#152025',
        muted: '#F1F4F6',
        'muted-foreground': '#677681',
        border: '#E2E8EC',
        input: '#E2E8EC',

        primary: {
          DEFAULT: '#14B8A6',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#D4F1ED',
          foreground: '#0F5F58',
        },
        destructive: {
          DEFAULT: '#E14545',
          foreground: '#FFFFFF',
        },
        ring: '#14B8A6',

        // Domain accents (kept literal so RN classes match the web palette)
        rose: { 50: '#FFF1F2', 100: '#FFE4E6', 600: '#E11D48', 700: '#BE123C' },
        emerald: { 50: '#ECFDF5', 100: '#D1FAE5', 500: '#10B981', 600: '#059669', 700: '#047857' },
        blue: { 50: '#EFF6FF', 100: '#DBEAFE', 500: '#3B82F6', 600: '#2563EB' },
        amber: { 50: '#FFFBEB', 100: '#FEF3C7', 600: '#D97706', 700: '#B45309' },
        purple: { 50: '#FAF5FF', 100: '#F3E8FF', 600: '#9333EA' },
        orange: { 50: '#FFF7ED', 100: '#FFEDD5', 500: '#F97316', 600: '#EA580C' },
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
