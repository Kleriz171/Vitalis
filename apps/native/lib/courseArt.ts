import { lightColors as colors } from './theme';

// Illustrations always use the light palette: they are spot art on their own disc,
// and dark ink outlines must stay visible in dark mode too.
// One illustration set for the first-aid courses, keyed by course slug.
// Shared grammar: 96×96, soft teal disc, ink outlines (2.5), white bodies,
// teal for the helpful thing, red only for the hazard. Limbs and pipes are
// an ink stroke under a thinner white stroke, which reads as an outlined tube.
const ink = colors.dark;
const bg = colors.accent;
const teal = colors.primary;
const red = colors.destructive;

const tube = (d: string) =>
  `<path d="${d}" stroke="${ink}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
  `<path d="${d}" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;

const svg = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" stroke-linecap="round" stroke-linejoin="round">` +
  `<defs><clipPath id="disc"><circle cx="48" cy="48" r="46"/></clipPath></defs>` +
  `<g clip-path="url(#disc)"><circle cx="48" cy="48" r="46" fill="${bg}"/>${body}</g></svg>`;

const art: Record<string, string> = {
  'cpr-adult': svg(`
    <path d="M10 76 Q48 60 86 76" stroke="${ink}" stroke-width="2.5"/>
    <path d="M37 6 L40 50 H56 L59 6" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
    <rect x="33" y="47" width="30" height="16" rx="8" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
    <path d="M41 50 V56 M48 50 V57 M55 50 V56" stroke="${ink}" stroke-width="2"/>
    <path d="M24 56 L16 51 M23 64 H14 M72 56 L80 51 M73 64 H82" stroke="${teal}" stroke-width="3"/>`),

  'aed-use': svg(`
    <path d="M38 22 V17 a4 4 0 0 1 4 -4 h12 a4 4 0 0 1 4 4 V22" stroke="${ink}" stroke-width="2.5"/>
    <rect x="20" y="22" width="56" height="40" rx="9" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
    <path d="M48 56 C36 48 33 40 37 35.5 C40.5 32 45.5 33 48 37 C50.5 33 55.5 32 59 35.5 C63 40 60 48 48 56 Z" fill="${teal}" stroke="${ink}" stroke-width="2.5"/>
    <path d="M49.5 37 L44 46 H48.5 L46.5 52 L52.5 43 H48 Z" fill="#fff"/>
    <path d="M32 62 C32 67 26 66 26 71 M64 62 C64 67 70 66 70 71" stroke="${ink}" stroke-width="2.5"/>
    <rect x="18" y="71" width="16" height="11" rx="3" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
    <rect x="62" y="71" width="16" height="11" rx="3" fill="#fff" stroke="${ink}" stroke-width="2.5"/>`),

  'bleeding-control': svg(`
    <g transform="rotate(-38 46 54)">
      <rect x="14" y="41" width="64" height="26" rx="13" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
      <rect x="36" y="41" width="20" height="26" fill="${bg}" stroke="${ink}" stroke-width="2.5"/>
      <circle cx="24" cy="50" r="1.6" fill="${ink}"/><circle cx="24" cy="58" r="1.6" fill="${ink}"/>
      <circle cx="68" cy="50" r="1.6" fill="${ink}"/><circle cx="68" cy="58" r="1.6" fill="${ink}"/>
    </g>
    <path d="M28 14 C24 20 19 26 19 31 a9 9 0 0 0 18 0 C37 26 32 20 28 14 Z" fill="${red}" stroke="${ink}" stroke-width="2.5"/>`),

  'choking-adult': svg(`
    <path d="M32 94 V72 C22 66 20 52 22 41 C25 25 38 16 53 18 C66 20 72 30 72 40 L77 50 C78 52 77 53.5 75 53.5 H72 V58 C72 62 70 64 66 64 H60 V94" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
    <path d="M70 58 C62 59 56 63 55 70 V90" stroke="${teal}" stroke-width="2.5" stroke-dasharray="3 4"/>
    <circle cx="55" cy="72" r="5" fill="${red}" stroke="${ink}" stroke-width="2.5"/>
    <path d="M84 62 V40 M79 45 L84 40 L89 45" stroke="${teal}" stroke-width="3"/>`),

  'recovery-position': svg(`
    <path d="M4 70 H92" stroke="${ink}" stroke-width="2.5"/>
    ${tube('M52 60 L84 62')}
    ${tube('M28 57 L52 60')}
    ${tube('M52 58 L64 42 L74 60')}
    <circle cx="19" cy="54" r="9" fill="#fff" stroke="${ink}" stroke-width="2.5"/>
    <path d="M14 40 q-3 -3 0 -6 M21 38 q-3 -3 0 -6" stroke="${teal}" stroke-width="2.5"/>`),

  'burns-first-aid': svg(`
    ${tube('M6 30 H43 Q54 30 54 41')}
    <path d="M32 23 V16 M24 14 H40" stroke="${ink}" stroke-width="3"/>
    <path d="M49 52 V60 M54 50 V64 M59 52 V60" stroke="${teal}" stroke-width="3"/>
    <path d="M54 88 C45 88 41 80 45 73 C46.5 76 48.5 77.5 50 76.5 C48 70 52 64 57 61 C57 66.5 64 70 63 78.5 C62.4 84.5 58.5 88 54 88 Z" fill="${red}" stroke="${ink}" stroke-width="2.5"/>`),
};

/** SVG markup for a course's illustration, or null for a course without one. */
export const courseArt = (slug: string) => art[slug] ?? null;
export const courseSlugs = Object.keys(art);
