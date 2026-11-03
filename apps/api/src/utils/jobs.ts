// Last run and last failure of each background sweep, for the admin health page.
// ponytail: in memory, per API process; resets on restart (the page says since when).
export const jobs: Record<string, { lastRunAt?: Date; lastErrorAt?: Date; lastError?: string; runs: number; failures: number }> = {};
export const startedAt = new Date();

export function jobRan(name: string, err?: unknown) {
  const j = (jobs[name] ??= { runs: 0, failures: 0 });
  j.runs++;
  j.lastRunAt = new Date();
  if (err) { j.failures++; j.lastErrorAt = new Date(); j.lastError = String((err as any)?.message ?? err).slice(0, 200); }
}
