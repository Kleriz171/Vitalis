// One motion language for the console: quick ease-out, no springs, no bounce.
export const EASE = [0.22, 1, 0.36, 1] as const; // ease-out-quint
export const FAST = { duration: 0.2, ease: EASE };
export const BASE = { duration: 0.32, ease: EASE };
export const SLOW = { duration: 0.5, ease: EASE };
