import type { Icon } from '@phosphor-icons/react';
import { cn } from '../../lib/utils';

// Same idea as the phone app's row icons: a soft tinted square, the icon coloured by meaning.
// Vitalis colours only: teal and deep green for everything, red strictly for SOS and danger.
// (amber/blue/violet are kept as names so older call sites still compile; they map to greens.)
const TEAL = 'bg-[hsl(173_55%_92%)] text-[hsl(175_77%_24%)]';
const DEEP = 'bg-[hsl(175_77%_21%)] text-white';
const MINT = 'bg-[hsl(160_40%_92%)] text-[hsl(173_79%_30%)]';
const TONES = {
  teal: TEAL,
  deep: DEEP,
  mint: MINT,
  sos: 'bg-[hsl(0_80%_95%)] text-[hsl(0_72%_48%)]',
  amber: MINT,
  blue: TEAL,
  violet: DEEP,
  slate: 'bg-muted text-muted-foreground',
  // On the green band: translucent white, like the phone app's header tile.
  band: 'bg-white/[0.14] text-white',
  solid: 'bg-[hsl(var(--teal))] text-white',
} as const;
const SIZES = { sm: 'w-8 h-8 rounded-[10px]', md: 'w-10 h-10 rounded-xl', lg: 'w-12 h-12 rounded-[14px]' } as const;
const ICON = { sm: 17, md: 21, lg: 25 } as const;

export type TileTone = keyof typeof TONES;

export const Tile = ({ icon: I, tone = 'teal', size = 'md', round = false, className }: { icon: Icon; tone?: TileTone; size?: keyof typeof SIZES; round?: boolean; className?: string }) => (
  <span className={cn('shrink-0 grid place-items-center', SIZES[size], round && '!rounded-full', TONES[tone], className)} aria-hidden>
    <I size={ICON[size]} weight="duotone" />
  </span>
);
