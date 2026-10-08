/** Fall detector on synthetic 50 Hz accelerometer traces.  npx tsx apps/native/scripts/fall-check.ts */
import assert from 'node:assert/strict';
import { createFallDetector, Sample } from '../lib/fallDetector';

// Build a trace from [g, durationMs] segments (magnitude on z, sampled every 20 ms).
const trace = (...parts: [number, number][]) => {
  const out: Sample[] = [];
  let t = 0;
  for (const [g, ms] of parts) for (let i = 0; i < ms; i += 20, t += 20) out.push({ x: 0, y: 0, z: g, t });
  return out;
};
const falls = (samples: Sample[]) => { let n = 0; const feed = createFallDetector(() => n++); samples.forEach(feed); return n; };

assert.equal(falls(trace([1, 500], [0.1, 300], [3.5, 60], [1.6, 200], [1, 2500])), 1, 'fall, impact, lying still');
assert.equal(falls(trace([1, 500], [0.1, 300], [3.5, 60], [1, 800], [1.8, 400], [1, 2500])), 0, 'got up after the fall');
assert.equal(falls(trace([1, 500], [0.1, 40], [3.5, 60], [1, 2500])), 0, 'tiny drop (40 ms free fall)');
assert.equal(falls(trace([1, 500], [3.5, 60], [1, 2500])), 0, 'hard bump without free fall');
assert.equal(falls(trace([1, 500], [0.1, 300], [1.2, 1500], [3.5, 60], [1, 2500])), 0, 'impact too long after free fall');
assert.equal(falls(trace([1, 500], [0.1, 300], [1.5, 200], [1, 2500])), 0, 'free fall caught softly (no impact)');
console.log('  ✓ fall detector: real fall caught; getting up, tiny drops, bumps and soft catches ignored');
