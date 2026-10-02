import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    // The monorepo root holds React 19 for the mobile app; libraries hoisted there
    // (react-redux, …) must use this app's React 18, or hooks break at runtime.
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react()],
  server: { port: 5175 }, // localhost only: the Vite dev server has open path-traversal advisories
});
