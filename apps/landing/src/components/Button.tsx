import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../lib/cn';

type Variant = 'primary' | 'ghost' | 'outline';
type Size = 'sm' | 'md' | 'lg';

type Props = HTMLMotionProps<'a'> & {
  variant?: Variant;
  size?: Size;
  href?: string;
};

const variants: Record<Variant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:shadow-[0_12px_32px_-8px_hsl(173_80%_40%/0.55)]',
  outline:
    'border border-border bg-card/70 text-foreground hover:border-primary/50 hover:text-primary',
  ghost: 'text-foreground hover:bg-accent/60',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-11 px-5 text-sm rounded-lg gap-2',
  lg: 'h-12 px-6 text-base rounded-xl gap-2',
};

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: Props) => (
  <motion.a
    whileHover={{ y: -2 }}
    whileTap={{ y: 0, scale: 0.98 }}
    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    className={cn(
      'inline-flex items-center justify-center font-medium transition-shadow select-none cursor-pointer',
      variants[variant],
      sizes[size],
      className,
    )}
    {...rest}
  >
    {children}
  </motion.a>
);
