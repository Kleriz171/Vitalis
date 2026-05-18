import { motion } from 'framer-motion';
import { ArrowRight, Smartphone, Activity, Plane, Boxes, MapPin } from 'lucide-react';
import { Button } from '../components/Button';
import { StoreBadges } from '../components/StoreBadges';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.1 + i * 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  }),
};

const pills = [
  { icon: MapPin, label: 'Live incidents' },
  { icon: Plane, label: 'Drone dispatch' },
  { icon: Boxes, label: 'Audit ledger' },
  { icon: Activity, label: 'Vitals & KPIs' },
];

export const Hero = () => (
  <section className="relative overflow-hidden">
    <div
      aria-hidden
      className="absolute inset-0 -z-10 bg-grid-soft [background-size:28px_28px] opacity-50 [mask-image:radial-gradient(60%_50%_at_50%_30%,#000_30%,transparent_75%)]"
    />
    <div className="mx-auto max-w-7xl px-6 md:px-10 pt-20 md:pt-28 pb-20 md:pb-32 grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
      <div>
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium"
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          Live · v0.1 prototype
        </motion.div>

        <motion.h1
          variants={fadeUp}
          custom={1}
          initial="hidden"
          animate="show"
          className="mt-5 text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.02] text-balance"
        >
          The command center for{' '}
          <span className="relative inline-block">
            <span className="bg-gradient-to-r from-health-teal via-health-teal to-health-teal-deep bg-clip-text text-transparent">
              real-time
            </span>
            <motion.span
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.7, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 -bottom-1 h-[6px] w-full origin-left rounded-full bg-primary/25"
            />
          </span>{' '}
          bio-logistics.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          custom={2}
          initial="hidden"
          animate="show"
          className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl text-pretty leading-relaxed"
        >
          Vitalis connects citizens, responders, drones, hospitals, and dispatchers into one
          live network — SOS to scene to ledger, in seconds.
        </motion.p>

        <motion.div
          variants={fadeUp}
          custom={3}
          initial="hidden"
          animate="show"
          className="mt-8 flex flex-wrap gap-3"
        >
          <Button href="http://localhost:5173" size="lg">
            Open command portal <ArrowRight size={16} />
          </Button>
          <Button href="http://localhost:5174" variant="outline" size="lg">
            <Smartphone size={16} /> Open web mobile
          </Button>
        </motion.div>

        <motion.div
          variants={fadeUp}
          custom={4}
          initial="hidden"
          animate="show"
          className="mt-8"
        >
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground mb-3">
            Citizen & responder app
          </div>
          <StoreBadges />
        </motion.div>

        <motion.div
          variants={fadeUp}
          custom={5}
          initial="hidden"
          animate="show"
          className="mt-8 flex flex-wrap gap-2"
        >
          {pills.map((p) => (
            <motion.span
              key={p.label}
              whileHover={{ y: -2 }}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground"
            >
              <p.icon size={13} className="text-primary" />
              {p.label}
            </motion.span>
          ))}
        </motion.div>
      </div>

      <HeroPanel />
    </div>
  </section>
);

const HeroPanel = () => (
  <motion.div
    initial={{ opacity: 0, y: 40, rotateX: 6 }}
    animate={{ opacity: 1, y: 0, rotateX: 0 }}
    transition={{ delay: 0.3, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
    className="relative"
    style={{ perspective: 1200 }}
  >
    <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-hero-glow blur-2xl opacity-80" />
    <div className="relative rounded-2xl border border-border bg-card/80 ring-soft p-4 backdrop-blur">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
        </div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          /command/logistics
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <KPICard label="Active SOS" value="14" tone="teal" delay={0.5} />
        <KPICard label="Drones aloft" value="6" tone="mint" delay={0.6} />
        <KPICard label="Avg response" value="3:42" tone="sand" delay={0.7} />
      </div>

      <div className="mt-3 relative rounded-xl border border-border bg-gradient-to-br from-health-mint/40 via-card to-health-teal-soft/40 h-56 overflow-hidden">
        <FakeMap />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <IncidentRow label="SOS · cardiac" status="dispatched" delay={0.9} />
        <IncidentRow label="Blood delivery · O-" status="aloft" delay={1.0} />
      </div>
    </div>

    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      className="absolute -right-6 -top-6 hidden md:flex items-center gap-2 rounded-xl bg-card border border-border px-3 py-2 ring-soft"
    >
      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      <span className="text-xs font-medium">Ledger verified</span>
    </motion.div>
  </motion.div>
);

const toneMap = {
  teal: 'from-health-teal-soft to-card text-health-teal-deep',
  mint: 'from-health-mint to-card text-emerald-700',
  sand: 'from-health-sand to-card text-foreground',
} as const;

const KPICard = ({
  label,
  value,
  tone,
  delay,
}: {
  label: string;
  value: string;
  tone: keyof typeof toneMap;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.6 }}
    className={`rounded-xl p-3 bg-gradient-to-br ${toneMap[tone]} border border-border`}
  >
    <div className="text-[10px] uppercase tracking-widest opacity-70">{label}</div>
    <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
  </motion.div>
);

const IncidentRow = ({
  label,
  status,
  delay,
}: {
  label: string;
  status: string;
  delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, x: -10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay, duration: 0.5 }}
    className="rounded-lg border border-border bg-card/80 px-3 py-2 flex items-center justify-between"
  >
    <span className="text-xs font-medium">{label}</span>
    <span className="text-[10px] uppercase tracking-widest text-primary font-semibold">
      {status}
    </span>
  </motion.div>
);

const FakeMap = () => (
  <>
    <svg className="absolute inset-0 w-full h-full opacity-30" aria-hidden>
      <defs>
        <pattern id="g" width="24" height="24" patternUnits="userSpaceOnUse">
          <path d="M24 0H0V24" fill="none" stroke="hsl(173 40% 60%)" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)" />
    </svg>
    {[
      { x: '22%', y: '38%', d: 0 },
      { x: '58%', y: '28%', d: 0.4 },
      { x: '74%', y: '62%', d: 0.8 },
      { x: '36%', y: '70%', d: 1.2 },
    ].map((p, i) => (
      <span
        key={i}
        className="absolute flex h-3 w-3 -translate-x-1/2 -translate-y-1/2"
        style={{ left: p.x, top: p.y, animationDelay: `${p.d}s` }}
      >
        <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-50 animate-pulse-ring" />
        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary ring-2 ring-card" />
      </span>
    ))}
    <motion.div
      initial={{ x: '0%', y: '50%' }}
      animate={{ x: ['0%', '90%'], y: ['50%', '20%'] }}
      transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
      className="absolute"
    >
      <Plane size={16} className="text-foreground/70" />
    </motion.div>
  </>
);
