/**
 * Lists t()/tn() source strings that have no Albanian entry, and Albanian entries nothing uses.
 *   npx tsx apps/native/scripts/i18n-check.ts
 * Exits non-zero when a string is missing, so it can gate a release.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sq, ui } from '../lib/i18n.sq';

const root = join(__dirname, '..');
const files: string[] = [];
const walk = (dir: string) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx?$/.test(f) && !f.startsWith('i18n')) files.push(p);
  }
};
['app', 'components', 'lib'].forEach(d => walk(join(root, d)));

// t('…') / t("…") and both string arguments of tn(n, '…', '…').
const literal = /(['"])((?:\\.|(?!\1).)*)\1/g;
const used = new Set<string>();
const unescape = (x: string) => x.replace(/\\n/g, '\n').replace(/\\(['"])/g, '$1');
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  for (const m of src.matchAll(/\bt\(\s*(['"])((?:\\.|(?!\1).)*)\1/g)) used.add(unescape(m[2]));
  for (const m of src.matchAll(/\bapiError\([^,]+,\s*(['"])((?:\\.|(?!\1).)*)\1/g)) used.add(unescape(m[2]));
  for (const m of src.matchAll(/\btn\([^,]+,\s*((['"])(?:\\.|(?!\2).)*\2)\s*,\s*((['"])(?:\\.|(?!\4).)*\4)/g)) {
    for (const lit of [m[1], m[3]]) for (const x of lit.matchAll(literal)) used.add(unescape(x[2]));
  }
}

const missing = [...used].filter(k => !(k in sq)).sort();
// API messages arrive at runtime, so only UI entries can be unused.
const unused = Object.keys(ui).filter(k => !used.has(k)).sort();
if (unused.length) console.log(`Unused Albanian entries (${unused.length}):\n  ${unused.join('\n  ')}`);
if (missing.length) {
  console.log(`Missing Albanian (${missing.length}):\n  ${missing.join('\n  ')}`);
  process.exit(1);
}
console.log(`i18n: ${used.size} strings, all translated.`);
