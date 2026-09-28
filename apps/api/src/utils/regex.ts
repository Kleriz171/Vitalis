// User input goes into $regex; escape it so it matches literally and can't ReDoS.
export const escapeRegex = (s: string) => s.slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
