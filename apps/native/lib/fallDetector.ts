// Fall = free fall, then a hard impact, then the phone lying still. All three are required,
// so a dropped phone that is picked up, a jump or a bumpy ride does not trigger it.
// Pure (no React Native imports) so scripts/fall-check.ts can test it with synthetic samples.
export type Sample = { x: number; y: number; z: number; t: number }; // acceleration in g, time in ms

export const FALL = {
  freeFallG: 0.4, // near-weightless
  freeFallMs: 80, // for at least this long (a ~3 cm drop is shorter)
  impactG: 2.8, // then a hard hit
  impactWithinMs: 1000,
  settleMs: 300, // bounces right after the hit are ignored
  stillMs: 2000, // then no movement for this long
  stillToleranceG: 0.2,
};

export function createFallDetector(onFall: () => void) {
  let freeFallStart: number | null = null;
  let freeFallEnd: number | null = null;
  let impactAt: number | null = null;

  return (s: Sample) => {
    const g = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);

    if (impactAt !== null) {
      const since = s.t - impactAt;
      if (since > FALL.settleMs && Math.abs(g - 1) > FALL.stillToleranceG) { impactAt = null; return; } // moving: they are up
      if (since >= FALL.stillMs) { impactAt = null; onFall(); }
      return;
    }
    if (g < FALL.freeFallG) {
      if (freeFallStart === null) freeFallStart = s.t;
      freeFallEnd = null;
      return;
    }
    if (freeFallStart !== null && freeFallEnd === null) {
      if (s.t - freeFallStart >= FALL.freeFallMs) freeFallEnd = s.t;
      else freeFallStart = null;
    }
    if (freeFallEnd !== null) {
      if (g >= FALL.impactG) { impactAt = s.t; freeFallStart = freeFallEnd = null; return; }
      if (s.t - freeFallEnd > FALL.impactWithinMs) freeFallStart = freeFallEnd = null;
    }
  };
}
