// Pasting coordinates into the drone card: npx tsx apps/desktop/scripts/geo-check.ts
import assert from 'node:assert/strict';
import { bearingDeg, distanceM, formatCoords, parseCoords } from '../src/lib/geo';

const tirana: [number, number] = [19.8187, 41.3275];
assert.deepEqual(parseCoords('41.3275, 19.8187'), tirana);                      // maps apps: lat, lng
assert.deepEqual(parseCoords('41.3275° N, 19.8187° E'), tirana);                // the console's own format
assert.deepEqual(parseCoords('https://www.google.com/maps/@41.3275,19.8187,17z'), tirana);
assert.deepEqual(parseCoords('33.8688° S, 151.2093° E'), [151.2093, -33.8688]);
assert.deepEqual(parseCoords(formatCoords(tirana)), tirana);
assert.equal(parseCoords('Rruga e Kavajës'), null);
assert.equal(parseCoords('141.3, 19.8'), null);                                 // no latitude past 90
assert.ok(Math.abs(distanceM(tirana, [19.8187, 41.3284]) - 100) < 1);         // 0.0009° of latitude ≈ 100 m
assert.ok(Math.abs(bearingDeg(tirana, [19.8197, 41.3275]) - 90) < 0.1);       // due east
console.log('geo checks passed');
