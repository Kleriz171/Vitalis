import { Heart } from 'lucide-react';

export const Logo = ({ light = false }: { light?: boolean }) => (
  <span className="inline-flex items-center gap-2.5">
    <span className={light ? 'w-9 h-9 rounded-xl bg-white/15 text-white grid place-items-center' : 'w-9 h-9 rounded-xl bg-teal-deep text-white grid place-items-center'}>
      <Heart size={17} fill="currentColor" aria-hidden />
    </span>
    <span className={light ? 'text-lg font-bold text-white' : 'text-lg font-bold text-ink'}>Vitalis</span>
  </span>
);
