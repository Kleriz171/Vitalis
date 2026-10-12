import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Vitalis brand (same values as the apps; logo teal from brand/logo-source.png)
        page: '#073F3A',       // deep green: the city's night and the dark sections
        green: '#0C5D57',      // the apps' green
        logo: '#0E8B7F',       // the logo's teal: large text and shapes only (white body text fails AA on it)
        mint: '#9FE3D8',
        mist: '#BFD8D5',       // body text on the dark greens (7.8:1 on page)
        amber: '#FFC24B',      // the defibrillator runner
        ink: 'hsl(var(--ink))',
        paper: 'hsl(var(--paper))',
        muted: 'hsl(var(--muted))',
        sos: 'hsl(var(--sos))',
        border: 'hsl(var(--border))',
        // used by /verify, /track and /privacy
        'teal-deep': 'hsl(var(--teal-deep))',
        teal: 'hsl(var(--teal))',
        'teal-soft': 'hsl(var(--teal-soft))',
      },
      fontFamily: { sans: ['Schibsted Grotesk', 'system-ui', 'sans-serif'] },
      minWidth: { 11: '2.75rem' },
    },
  },
} satisfies Config;
