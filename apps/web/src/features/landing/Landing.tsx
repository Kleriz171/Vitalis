import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, ArrowRight, Smartphone, MapPin, Plane, Boxes, BarChart3 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';

const features = [
  { icon: MapPin, title: 'Logistics Map', body: 'Live geo-tracked emergency feed with status drawer and incident timelines.' },
  { icon: Plane, title: 'Drone Dispatch', body: 'Queue and monitor aerial deliveries for blood, plasma, and rare meds.' },
  { icon: Boxes, title: 'Audit Ledger', body: 'SHA-256 chained immutable log of every state change. Independently verifiable.' },
  { icon: BarChart3, title: 'Analytics', body: 'KPIs and incident-type distribution for operational oversight.' },
];

const MOBILE_URL = import.meta.env.VITE_MOBILE_URL ?? 'http://localhost:5174';

export const Landing = () => (
  <div className="relative min-h-screen bg-background overflow-hidden">
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage:
          'radial-gradient(70% 50% at 50% -10%, hsl(173 80% 92% / 0.55) 0%, transparent 60%), radial-gradient(40% 40% at 100% 30%, hsl(160 60% 92% / 0.5) 0%, transparent 60%)',
      }}
    />

    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex items-center justify-between px-6 md:px-12 py-5 border-b border-border bg-card/40 backdrop-blur sticky top-0 z-30"
    >
      <div className="flex items-center gap-3">
        <motion.div
          whileHover={{ rotate: -6, scale: 1.05 }}
          className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-[0_8px_24px_-8px_hsl(173_80%_40%/0.5)]"
        >
          <Heart size={18} fill="currentColor" />
        </motion.div>
        <div>
          <div className="font-extrabold tracking-wide">VITALIS</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest -mt-0.5">Operator portal</div>
        </div>
      </div>
      <Link to="/login">
        <Button size="sm">Operator sign in <ArrowRight size={14} /></Button>
      </Link>
    </motion.header>

    <section className="px-6 md:px-12 pt-16 md:pt-24 pb-16 max-w-6xl mx-auto">
      <motion.div
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
        className="space-y-6 max-w-3xl"
      >
        <motion.div
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Desktop · Operator-only access
        </motion.div>
        <motion.h1
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } }}
          className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]"
        >
          The command center for<br />
          <span className="bg-gradient-to-r from-health-teal to-health-teal-deep bg-clip-text text-transparent">
            real-time bio-logistics.
          </span>
        </motion.h1>
        <motion.p
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="text-lg text-muted-foreground max-w-2xl"
        >
          Dispatchers, drone operators, and administrators run incident response from here.
          Citizens and field responders use the <span className="text-primary font-medium">Vitalis mobile app</span> instead.
        </motion.p>
        <motion.div
          variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } }}
          className="flex flex-wrap gap-3"
        >
          <Link to="/login">
            <Button size="lg">Operator sign in <ArrowRight size={16} /></Button>
          </Link>
          <Button
            size="lg"
            variant="outline"
            onClick={() => window.open(MOBILE_URL, '_blank')}
          >
            <Smartphone size={16} /> Open mobile app
          </Button>
        </motion.div>
      </motion.div>

      <div className="mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ delay: i * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -4 }}
          >
            <Card className="p-5 h-full transition-colors hover:border-primary/40">
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3">
                <f.icon size={18} />
              </div>
              <div className="text-xs font-mono text-muted-foreground mb-2">0{i + 1}</div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </section>

    <footer className="border-t border-border px-6 md:px-12 py-6 text-xs text-muted-foreground flex justify-between">
      <span>© Vitalis prototype · Operator portal</span>
      <span className="font-mono">v0.1.0</span>
    </footer>
  </div>
);
