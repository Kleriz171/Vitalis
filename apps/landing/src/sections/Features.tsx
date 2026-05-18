import { motion } from 'framer-motion';
import {
  MapPin,
  Plane,
  Boxes,
  BarChart3,
  HeartPulse,
  QrCode,
  Droplet,
  Stethoscope,
} from 'lucide-react';

const features = [
  {
    icon: MapPin,
    title: 'Logistics map',
    body: 'A live Mapbox view of incidents, responders, hospitals, and drones, with status drawers and incident timelines.',
    tone: 'from-health-teal-soft/70',
  },
  {
    icon: Plane,
    title: 'Drone dispatch',
    body: 'Plan, queue, and monitor aerial deliveries for blood, plasma, and rare medications — radius-aware.',
    tone: 'from-health-mint/70',
  },
  {
    icon: Boxes,
    title: 'Tamper-evident ledger',
    body: 'Every critical action is mined into a SHA-256 chained, append-only log. Integrity verifiable in one call.',
    tone: 'from-amber-100/70',
  },
  {
    icon: BarChart3,
    title: 'Operational analytics',
    body: 'Response times, incident throughput, inventory health. KPIs for the people running the network.',
    tone: 'from-rose-100/70',
  },
  {
    icon: HeartPulse,
    title: 'SOS in one tap',
    body: 'Citizens broadcast emergencies with geolocation. Fans out to nearby responders and dispatchers instantly.',
    tone: 'from-health-teal-soft/70',
  },
  {
    icon: QrCode,
    title: 'Bio Passport',
    body: 'Portable health record with a QR code scannable by paramedics — allergies, blood type, contacts.',
    tone: 'from-violet-100/70',
  },
  {
    icon: Droplet,
    title: 'Blood & medicine',
    body: 'Match transfusion requests against live hospital inventory. Radar for nearby pharmacy stock.',
    tone: 'from-rose-100/70',
  },
  {
    icon: Stethoscope,
    title: 'Live-Link teleconsult',
    body: 'WebRTC video consults with verified doctors. Patient context auto-pulled on accept.',
    tone: 'from-health-mint/70',
  },
];

export const Features = () => (
  <section id="platform" className="relative py-24 md:py-32">
    <div className="mx-auto max-w-7xl px-6 md:px-10">
      <SectionHeader
        eyebrow="Platform"
        title="One real-time network. Every actor sees the same world update live."
        body="Built as a monorepo of three frontends — a desktop command portal, a mobile PWA, and a native shell — sharing one Node API, MongoDB, and Socket.io."
      />

      <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: (i % 4) * 0.06, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6 }}
            className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${f.tone} to-card p-5 ring-soft`}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <f.icon size={18} />
            </div>
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            <span className="pointer-events-none absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-primary/0 group-hover:bg-primary/10 transition-colors duration-500" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

export const SectionHeader = ({
  eyebrow,
  title,
  body,
}: {
  eyebrow: string;
  title: string;
  body?: string;
}) => (
  <div className="max-w-3xl">
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-primary font-semibold"
    >
      <span className="h-px w-6 bg-primary/50" />
      {eyebrow}
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="mt-3 text-3xl md:text-5xl font-extrabold tracking-tight leading-[1.05] text-balance"
    >
      {title}
    </motion.h2>
    {body && (
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="mt-4 text-lg text-muted-foreground text-pretty"
      >
        {body}
      </motion.p>
    )}
  </div>
);
