import { Heart } from 'lucide-react';
import { motion } from 'framer-motion';

export const Logo = ({ compact = false }: { compact?: boolean }) => (
  <div className="flex items-center gap-3">
    <motion.div
      whileHover={{ scale: 1.06, rotate: -4 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className="relative w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-[0_8px_24px_-8px_hsl(173_80%_40%/0.6)]"
    >
      <Heart size={18} fill="currentColor" />
      <span className="absolute inset-0 rounded-xl border border-primary/50 animate-pulse-ring pointer-events-none" />
    </motion.div>
    {!compact && (
      <div className="leading-tight">
        <div className="font-extrabold tracking-wide text-foreground">VITALIS</div>
        <div className="text-[10px] text-muted-foreground uppercase tracking-[0.22em] -mt-0.5">
          Real-time bio-logistics
        </div>
      </div>
    )}
  </div>
);
