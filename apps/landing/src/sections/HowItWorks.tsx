import { motion } from 'framer-motion';
import { Smartphone, Radio, Monitor, ShieldCheck } from 'lucide-react';
import { SectionHeader } from './Features';

const steps = [
  {
    icon: Smartphone,
    label: 'Citizen',
    title: 'One-tap SOS',
    body: 'Mobile app broadcasts geolocation. Bio Passport queued. Live timer starts.',
  },
  {
    icon: Radio,
    label: 'Responders',
    title: 'Nearby pickup',
    body: 'Verified doctors, nurses, and student responders accept and navigate from a live inbox.',
  },
  {
    icon: Monitor,
    label: 'Dispatch',
    title: 'Command view',
    body: 'Operators see incidents, dispatch drones, and orchestrate blood and medicine logistics.',
  },
  {
    icon: ShieldCheck,
    label: 'Ledger',
    title: 'Tamper-evident trail',
    body: 'Every state change is mined into a SHA-256 chain. Independently verifiable forever.',
  },
];

export const HowItWorks = () => (
  <section id="how" className="relative py-24 md:py-32 bg-gradient-to-b from-transparent via-health-teal-soft/30 to-transparent">
    <div className="mx-auto max-w-7xl px-6 md:px-10">
      <SectionHeader
        eyebrow="How it works"
        title="SOS to scene to ledger — in seconds."
        body="Role-based clients on a single real-time backbone. Citizens never touch the operator portal; operators never touch the citizen app. The API enforces it on every route."
      />

      <div className="relative mt-16">
        <div
          aria-hidden
          className="hidden md:block absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              <div className="relative z-10 mx-auto md:mx-0 w-12 h-12 rounded-2xl bg-card border border-border ring-soft grid place-items-center text-primary">
                <s.icon size={20} />
              </div>
              <div className="mt-5 text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-mono">
                Step 0{i + 1} · {s.label}
              </div>
              <h3 className="mt-1 font-semibold text-lg">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
