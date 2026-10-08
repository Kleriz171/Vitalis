/** Road ETA: OSRM when reachable, straight-line estimate otherwise.  npx tsx apps/api/scripts/eta-check.ts */
import assert from 'node:assert/strict';
import { env } from '../src/config/env';
import { estimateEtaSeconds, roadEtaSeconds } from '../src/utils/geo';

const skanderbeg: [number, number] = [19.8187, 41.3275];
const qsut: [number, number] = [19.7976, 41.3346]; // Mother Teresa hospital, ~2 km

(async () => {
  const est = estimateEtaSeconds(skanderbeg, qsut);
  assert.ok(est > 120 && est < 600, `estimate ${est}s`);

  env.osrmUrl = 'http://127.0.0.1:9'; // nothing listens: must fall back, not throw
  assert.equal(await roadEtaSeconds(skanderbeg, qsut), est, 'falls back when routing is down');
  env.osrmUrl = '';
  assert.equal(await roadEtaSeconds(skanderbeg, qsut), est, 'estimate when routing is off');

  env.osrmUrl = process.env.OSRM_URL ?? 'https://router.project-osrm.org';
  const road = await roadEtaSeconds(skanderbeg, qsut);
  assert.ok(road > 60 && road < 1200 && road !== est, `road ${road}s (equal to the estimate means OSRM was not used)`);
  console.log(`  ✓ eta: road ${road}s vs estimate ${est}s; falls back when routing is down or off`);
})();
