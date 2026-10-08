import { Apple, Play } from 'lucide-react';

// Set these once the apps are live in the stores. Until then the buttons say so honestly.
const IOS = import.meta.env.VITE_APP_STORE_URL as string | undefined;
const ANDROID = import.meta.env.VITE_PLAY_STORE_URL as string | undefined;

export const StoreBadges = ({ dark = false }: { dark?: boolean }) => (
  <div className="flex flex-wrap gap-3">
    <Badge href={IOS} icon={<Apple size={22} fill="currentColor" strokeWidth={0} />} top="Download on the" store="App Store" dark={dark} />
    <Badge href={ANDROID} icon={<Play size={20} fill="currentColor" strokeWidth={0} />} top="Get it on" store="Google Play" dark={dark} />
  </div>
);

const Badge = ({ href, icon, top, store, dark }: { href?: string; icon: React.ReactNode; top: string; store: string; dark: boolean }) => {
  const cls = [
    'inline-flex items-center gap-3 h-14 pl-4 pr-5 rounded-xl transition-transform',
    dark ? 'bg-white text-ink' : 'bg-ink text-white',
    href ? 'hover:-translate-y-0.5 active:translate-y-0' : 'opacity-90 cursor-default',
  ].join(' ');
  const body = (
    <>
      {icon}
      <span className="flex flex-col leading-tight text-left">
        <span className="text-xs opacity-80">{href ? top : 'Coming soon to'}</span>
        <span className="text-lg font-semibold -mt-0.5">{store}</span>
      </span>
    </>
  );
  return href ? (
    <a href={href} className={cls} target="_blank" rel="noreferrer" aria-label={`${top} ${store}`}>{body}</a>
  ) : (
    <span className={cls} aria-label={`Coming soon to ${store}`}>{body}</span>
  );
};
