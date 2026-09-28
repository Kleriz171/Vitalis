import type { Request } from 'express';

/** The app sends Accept-Language: sq by default; the web console and landing page do not. */
export const wantsAlbanian = (req: Request) => /^sq\b/i.test(req.headers['accept-language'] ?? '');
