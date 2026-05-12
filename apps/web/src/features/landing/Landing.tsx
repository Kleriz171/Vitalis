import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '../../components/ui/Button';

const features = [
  { title: 'Logistics Map', body: 'Live geo-tracked emergency feed with status drawer and incident timelines.' },
  { title: 'Drone Dispatch', body: 'Queue and monitor aerial deliveries for blood, plasma, and rare meds.' },
  { title: 'Audit Ledger', body: 'SHA-256 chained immutable log of every state change. Independently verifiable.' },
  { title: 'Analytics', body: 'KPIs and incident-type distribution for operational oversight.' },
];

export const Landing = () => (
  <div className="min-h-screen relative overflow-hidden">
    <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

    <header className="relative flex items-center justify-between px-6 md:px-12 py-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-pink shadow-glow" />
        <div>
          <div className="font-bold tracking-widest neon-text">VITALIS</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest -mt-0.5">Operator portal</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/login"><Button size="sm">Operator sign in</Button></Link>
      </div>
    </header>

    <section className="relative px-6 md:px-12 pt-12 md:pt-20 pb-16 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="space-y-6 max-w-3xl"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">Desktop · Operator-only access</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
          The command center for<br />
          <span className="bg-gradient-to-r from-neon-cyan via-neon-violet to-neon-pink bg-clip-text text-transparent">
            real-time bio-logistics.
          </span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl">
          Dispatchers, drone operators, and administrators run incident response from here. Citizens and field responders
          use the <span className="text-neon-cyan">Vitalis mobile app</span> instead.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/login"><Button size="lg">Operator sign in →</Button></Link>
          <Button
            size="lg"
            variant="ghost"
            onClick={() => window.open('http://localhost:5174', '_blank')}
          >
            Open mobile app
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        className="mt-20 grid md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {features.map((f, i) => (
          <motion.div key={f.title} whileHover={{ y: -4 }} className="glass-strong p-5 hover:border-neon-cyan/30 transition">
            <div className="text-3xl font-mono text-neon-cyan/60 mb-3">0{i + 1}</div>
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-slate-400 leading-relaxed">{f.body}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>

    <footer className="relative border-t border-white/5 px-6 md:px-12 py-6 text-xs text-slate-500 flex justify-between">
      <span>© Vitalis prototype · Operator portal</span>
      <span className="font-mono">v0.1.0</span>
    </footer>
  </div>
);
