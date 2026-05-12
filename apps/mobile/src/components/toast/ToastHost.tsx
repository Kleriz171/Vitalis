import { AnimatePresence, motion } from 'framer-motion';
import { useToasts, dismissToast, ToastTone } from './toast';

const tones: Record<ToastTone, string> = {
  info: 'border-neon-cyan/40 bg-neon-cyan/5 text-neon-cyan',
  success: 'border-emerald-400/40 bg-emerald-400/5 text-emerald-300',
  warn: 'border-amber-400/40 bg-amber-400/5 text-amber-300',
  error: 'border-neon-pink/40 bg-neon-pink/5 text-neon-pink',
};

export const ToastHost = () => {
  const toasts = useToasts();
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))] pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map(t => (
          <motion.button
            key={t.id}
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            onClick={() => dismissToast(t.id)}
            className={`text-left pointer-events-auto glass-strong border ${tones[t.tone]} rounded-xl p-3 cursor-pointer`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider">{t.title}</div>
            {t.body && <div className="text-sm text-slate-200 mt-1">{t.body}</div>}
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
};
