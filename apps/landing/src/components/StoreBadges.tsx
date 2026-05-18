import { motion } from 'framer-motion';
import { Apple, Play } from 'lucide-react';
import { cn } from '../lib/cn';

type Props = {
  className?: string;
  iosHref?: string;
  androidHref?: string;
  size?: 'sm' | 'md';
};

const sizes = {
  sm: { h: 'h-11', label: 'text-[10px]', store: 'text-sm', icon: 18, gap: 'gap-2.5', px: 'px-3.5' },
  md: { h: 'h-14', label: 'text-[11px]', store: 'text-base', icon: 22, gap: 'gap-3', px: 'px-4' },
} as const;

export const StoreBadges = ({
  className,
  iosHref = '#',
  androidHref = '#',
  size = 'md',
}: Props) => {
  const s = sizes[size];
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Badge
        href={iosHref}
        size={s}
        label="Download on the"
        store="App Store"
        icon={<Apple size={s.icon} fill="currentColor" strokeWidth={0} />}
        ariaLabel="Download Vitalis on the App Store"
      />
      <Badge
        href={androidHref}
        size={s}
        label="Get it on"
        store="Google Play"
        icon={<Play size={s.icon} fill="currentColor" strokeWidth={0} />}
        ariaLabel="Get Vitalis on Google Play"
      />
    </div>
  );
};

const Badge = ({
  href,
  size,
  label,
  store,
  icon,
  ariaLabel,
}: {
  href: string;
  size: (typeof sizes)[keyof typeof sizes];
  label: string;
  store: string;
  icon: React.ReactNode;
  ariaLabel: string;
}) => (
  <motion.a
    href={href}
    aria-label={ariaLabel}
    target={href.startsWith('http') ? '_blank' : undefined}
    rel={href.startsWith('http') ? 'noreferrer' : undefined}
    whileHover={{ y: -2 }}
    whileTap={{ y: 0, scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    className={cn(
      'group inline-flex items-center rounded-xl bg-foreground text-background select-none',
      'shadow-[0_8px_24px_-12px_hsl(200_25%_12%/0.45)] ring-1 ring-foreground/10',
      'hover:shadow-[0_14px_32px_-12px_hsl(200_25%_12%/0.55)] transition-shadow',
      size.h,
      size.gap,
      size.px,
    )}
  >
    <span className="shrink-0">{icon}</span>
    <span className="flex flex-col leading-tight text-left">
      <span className={cn('opacity-80', size.label)}>{label}</span>
      <span className={cn('font-semibold tracking-tight', size.store)}>{store}</span>
    </span>
  </motion.a>
);
