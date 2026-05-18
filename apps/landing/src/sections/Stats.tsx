import { motion, useInView, useMotionValue, useTransform, animate } from 'framer-motion';
import { useEffect, useRef } from 'react';

const stats = [
  { value: 13, suffix: '', label: 'API modules', sub: 'auth · sos · drones · ledger · …' },
  { value: 4, suffix: '', label: 'Frontend shells', sub: 'web · mobile PWA · native · landing' },
  { value: 99.9, suffix: '%', label: 'Audit verifiability', sub: 'SHA-256 chained, difficulty-2' },
  { value: 3, suffix: 's', label: 'Avg fan-out', sub: 'SOS broadcast to nearby responders' },
];

const Counter = ({ to, suffix }: { to: number; suffix: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-50px' });
  const count = useMotionValue(0);
  const isFloat = to % 1 !== 0;
  const display = useTransform(count, (v) => (isFloat ? v.toFixed(1) : Math.round(v).toString()));

  useEffect(() => {
    if (!inView) return;
    const controls = animate(count, to, { duration: 1.6, ease: [0.22, 1, 0.36, 1] });
    return () => controls.stop();
  }, [inView, count, to]);

  return (
    <span ref={ref} className="tabular-nums">
      <motion.span>{display}</motion.span>
      {suffix}
    </span>
  );
};

export const Stats = () => (
  <section id="trust" className="relative py-24 md:py-32">
    <div className="mx-auto max-w-7xl px-6 md:px-10">
      <div className="rounded-3xl border border-border bg-card/70 ring-soft p-8 md:p-12 backdrop-blur">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.6 }}
            >
              <div className="text-5xl md:text-6xl font-extrabold tracking-tight text-primary">
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div className="mt-2 font-semibold">{s.label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.sub}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
