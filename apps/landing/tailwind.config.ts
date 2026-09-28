import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'hsl(var(--ink))',
        'teal-deep': 'hsl(var(--teal-deep))',
        teal: 'hsl(var(--teal))',
        'teal-soft': 'hsl(var(--teal-soft))',
        paper: 'hsl(var(--paper))',
        sos: 'hsl(var(--sos))',
        muted: 'hsl(var(--muted))',
        border: 'hsl(var(--border))',
      },
      fontFamily: { sans: ['Schibsted Grotesk', 'system-ui', 'sans-serif'] },
    },
  },
} satisfies Config;
