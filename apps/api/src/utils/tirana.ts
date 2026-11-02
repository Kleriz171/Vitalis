// Clinic hours are wall-clock times in Tirana; bookings are stored as UTC instants.
const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Tirane', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

/** Tirana's calendar date (YYYY-MM-DD), weekday (0 = Sunday) and HH:MM for an instant. */
export function inTirana(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]));
  const date = `${p.year}-${p.month}-${p.day}`;
  return { date, time: `${p.hour}:${p.minute}`, weekday: new Date(`${date}T12:00:00Z`).getUTCDay() };
}

/** The UTC instant of a wall-clock time in Tirana (handles summer time). */
export function tiranaTime(date: string, hhmm: string) {
  const guess = new Date(`${date}T${hhmm}:00Z`);
  const shown = inTirana(guess);
  const offset = Date.parse(`${shown.date}T${shown.time}:00Z`) - guess.getTime();
  return new Date(guess.getTime() - offset);
}

export const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

if (process.argv[1]?.endsWith('tirana.ts')) {
  // Self-check: winter UTC+1, summer UTC+2.
  console.assert(tiranaTime('2026-01-15', '09:00').toISOString() === '2026-01-15T08:00:00.000Z');
  console.assert(tiranaTime('2026-07-15', '09:00').toISOString() === '2026-07-15T07:00:00.000Z');
  console.assert(inTirana(new Date('2026-07-15T07:00:00Z')).time === '09:00');
  console.assert(inTirana(new Date('2026-11-02T12:00:00Z')).weekday === 1);
  console.log('tirana ok');
}
