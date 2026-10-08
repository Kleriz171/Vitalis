import { useEffect, useState } from 'react';

// One shared once-a-second tick for every clock and timer on screen. Components that show time
// subscribe to it, so a ticking timer re-renders itself and nothing around it.
const listeners = new Set<(now: number) => void>();
let timer: ReturnType<typeof setInterval> | undefined;

export function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    listeners.add(setNow);
    if (!timer) timer = setInterval(() => { const t = Date.now(); listeners.forEach(l => l(t)); }, 1000);
    return () => {
      listeners.delete(setNow);
      if (!listeners.size && timer) { clearInterval(timer); timer = undefined; }
    };
  }, []);
  return now;
}
