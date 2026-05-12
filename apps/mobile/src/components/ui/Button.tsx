import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type Variant = 'primary' | 'danger' | 'ghost' | 'subtle';
type Size = 'sm' | 'md' | 'lg';

interface Props extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-gradient-to-br from-neon-cyan to-cyan-400 text-ink-900 hover:brightness-110 shadow-glow',
  danger: 'bg-gradient-to-br from-neon-pink to-red-500 text-white hover:brightness-110 shadow-[0_0_24px_rgba(255,77,141,0.35)]',
  ghost: 'bg-white/5 hover:bg-white/10 text-slate-100 border border-white/10',
  subtle: 'text-slate-300 hover:text-neon-cyan',
};

const sizes: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs rounded-lg',
  md: 'px-4 py-2.5 text-sm rounded-xl',
  lg: 'px-6 py-3.5 text-base rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, className = '', disabled, ...rest }, ref) => (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.96 }}
      whileHover={{ y: -1 }}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </motion.button>
  )
);
Button.displayName = 'Button';
