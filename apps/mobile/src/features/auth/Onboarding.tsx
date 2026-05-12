import { motion } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Button } from '../../components/ui/Button';

export const Onboarding = () => {
  const token = useSelector((s: RootState) => s.auth.accessToken);
  if (token) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen flex flex-col px-6 pt-16 pb-10 relative overflow-hidden">
      <motion.div
        className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-neon-pink/30 blur-3xl"
        animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
      />
      <motion.div
        className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-neon-cyan/30 blur-3xl"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 8, repeat: Infinity, delay: 1 }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative space-y-6 mb-auto"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-neon-cyan to-neon-pink shadow-glow" />
          <div>
            <div className="font-extrabold tracking-widest neon-text text-xl">VITALIS</div>
            <div className="text-[11px] text-slate-400 uppercase tracking-wider">Mobile</div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative space-y-6"
      >
        <h1 className="text-4xl font-extrabold leading-tight">
          Help is one<br />
          <span className="bg-gradient-to-r from-neon-cyan to-neon-pink bg-clip-text text-transparent">
            tap away.
          </span>
        </h1>
        <p className="text-slate-400 text-base leading-relaxed">
          SOS broadcasts, rare-medicine radar, and your medical passport — wherever you go.
        </p>

        <ul className="space-y-2 text-sm text-slate-300">
          <Bullet>One-tap emergency broadcast</Bullet>
          <Bullet>Live responder ETA + tracking</Bullet>
          <Bullet>QR-secured Bio Passport</Bullet>
        </ul>

        <div className="space-y-2 pt-4">
          <Link to="/login?mode=register" className="block">
            <Button size="lg" className="w-full">Create account</Button>
          </Link>
          <Link to="/login" className="block">
            <Button size="lg" variant="ghost" className="w-full">I already have one</Button>
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 text-center pt-2">
          Operators: open the <span className="text-neon-cyan">desktop portal</span> instead.
        </p>
      </motion.div>
    </div>
  );
};

const Bullet = ({ children }: { children: React.ReactNode }) => (
  <li className="flex items-center gap-2">
    <span className="w-1.5 h-1.5 rounded-full bg-neon-cyan" />
    {children}
  </li>
);
