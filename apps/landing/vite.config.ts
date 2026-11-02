import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

/**
 * Production HTML: a Content-Security-Policy (only this site, the API and Google Fonts; the
 * /track page's OpenStreetMap frame), absolute share-image and canonical URLs for whichever domain
 * the site runs on (VITE_SITE_URL), and /privacy and /terms as real files so a static host
 * serves them without rewrite rules. Dev is left alone: Vite's dev server needs inline scripts.
 */
const productionHtml = (env: Record<string, string>): Plugin => {
  const site = (env.VITE_SITE_URL || 'https://vitalis-web.onrender.com').replace(/\/$/, '');
  const api = new URL(env.VITE_API_URL || 'http://localhost:4000/api').origin;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    'font-src https://fonts.gstatic.com',
    "img-src 'self' data:",
    `connect-src 'self' ${api}`,
    'frame-src https://www.openstreetmap.org',
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
  let outDir = 'dist';
  return {
    name: 'vitalis-production-html',
    apply: 'build',
    configResolved: c => { outDir = c.build.outDir; },
    transformIndexHtml: html => html
      .replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`)
      .replace('content="/og.jpg"', `content="${site}/og.jpg"`)
      .replace('<meta property="og:type" content="website" />', `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${site}/" />\n    <link rel="canonical" href="${site}/" />`),
    closeBundle: () => {
      const home = readFileSync(path.join(outDir, 'index.html'), 'utf8');
      for (const page of ['privacy', 'terms']) {
        mkdirSync(path.join(outDir, page), { recursive: true });
        writeFileSync(path.join(outDir, page, 'index.html'), home.replaceAll(`href="${site}/"`, `href="${site}/${page}"`).replaceAll(`content="${site}/"`, `content="${site}/${page}"`));
      }
    },
  };
};

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
    // The monorepo root holds React 19 for the mobile app; libraries hoisted there
    // (react-redux, …) must use this app's React 18, or hooks break at runtime.
    dedupe: ['react', 'react-dom'],
  },
  plugins: [react(), productionHtml(loadEnv(mode, process.cwd(), 'VITE_'))],
  server: { port: 5175 }, // localhost only: the Vite dev server has open path-traversal advisories
}));
