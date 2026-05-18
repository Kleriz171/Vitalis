import { motion } from 'framer-motion';
import { Users, HeartHandshake, Monitor } from 'lucide-react';
import { SectionHeader } from './Features';

const groups = [
  {
    icon: Users,
    title: 'Citizens',
    sub: 'Mobile · PWA',
    bullets: ['One-tap SOS with geolocation', 'Bio Passport with QR', 'Medicine radar + blood requests', 'First-aid training + AI triage'],
  },
  {
    icon: HeartHandshake,
    title: 'Responders',
    sub: 'Doctors · nurses · students',
    bullets: ['Live responder inbox', 'Patient context on accept', 'Live-Link WebRTC video', 'Status & navigation'],
  },
  {
    icon: Monitor,
    title: 'Dispatch & admins',
    sub: 'Desktop command portal',
    bullets: ['Live incident map', 'Drone mission planner', 'Blockchain audit log', 'Analytics & KPI dashboard'],
  },
];

export const Audiences = () => (
  <section id="teams" className="relative py-24 md:py-32">
    <div className="mx-auto max-w-7xl px-6 md:px-10">
      <SectionHeader
        eyebrow="For teams"
        title="Three audiences. Three shells. One source of truth."
      />

      <div className="mt-14 grid md:grid-cols-3 gap-5">
        {groups.map((g, i) => (
          <motion.div
            key={g.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
            className="relative overflow-hidden rounded-2xl border border-border bg-card/80 ring-soft p-6"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground grid place-items-center">
                <g.icon size={20} />
              </div>
              <div>
                <div className="font-semibold text-lg">{g.title}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">{g.sub}</div>
              </div>
            </div>
            <ul className="mt-5 space-y-2">
              {g.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2 text-sm text-foreground/80">
                  <span className="mt-2 h-1 w-1 rounded-full bg-primary shrink-0" />
                  {b}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
