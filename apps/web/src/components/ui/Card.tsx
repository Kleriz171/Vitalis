import { HTMLAttributes, ReactNode } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

interface Props extends Omit<HTMLMotionProps<'div'>, 'children'> {
  tone?: 'soft' | 'strong' | 'flat';
  glow?: boolean;
  children?: ReactNode;
}

const tones = {
  soft: 'bg-white/[0.04] backdrop-blur-md border border-white/10',
  strong: 'bg-white/[0.08] backdrop-blur-xl border border-white/15',
  flat: 'bg-ink-800/80 border border-white/5',
};

export const Card = ({ tone = 'soft', glow, className = '', children, ...rest }: Props) => (
  <motion.div
    className={`rounded-2xl ${tones[tone]} ${glow ? 'shadow-glow' : ''} ${className}`}
    {...rest}
  >
    {children}
  </motion.div>
);

export const CardHeader = ({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) => (
  <div className="flex items-start justify-between p-5 pb-3">
    <div>
      <h3 className="text-sm font-semibold text-slate-100 tracking-wide">{title}</h3>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const CardBody = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`px-5 pb-5 ${className}`}>{children}</div>
);
