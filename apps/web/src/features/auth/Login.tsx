import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/Button';
import { pushToast } from '../../components/toast/toast';

type Mode = 'login' | 'register';

// Operator portal — operators only. Citizens/responders use the mobile app.
const ROLES = [
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'admin', label: 'Admin' },
];

const OPERATOR_ROLES = ['dispatcher', 'admin'];

export const Login = () => {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('demo@vitalis.dev');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [role, setRole] = useState('citizen');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name, role };
      const { data } = await api.post(endpoint, body);

      if (!OPERATOR_ROLES.includes(data.user.role)) {
        setErr('This portal is for operators. Use the mobile app instead.');
        pushToast({ tone: 'warn', title: 'Wrong portal', body: 'Citizens & responders use the mobile app.' });
        setLoading(false);
        return;
      }

      dispatch(setSession(data));
      pushToast({ tone: 'success', title: mode === 'login' ? 'Welcome back' : 'Account created', body: data.user.email });
      nav('/command');
    } catch (e: any) {
      const msg = e.response?.data?.error ?? `${mode} failed`;
      setErr(msg);
      pushToast({ tone: 'error', title: 'Error', body: msg });
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

      <Link to="/" className="absolute top-6 left-6 flex items-center gap-2 text-sm text-slate-400 hover:text-neon-cyan">
        <span>←</span> Home
      </Link>

      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong w-full max-w-md p-8 space-y-5 relative"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neon-cyan to-neon-pink shadow-glow" />
          <div>
            <h1 className="text-2xl font-bold neon-text tracking-wider">VITALIS</h1>
            <p className="text-xs text-slate-400">Bio-logistics command access</p>
          </div>
        </div>

        <div className="flex bg-ink-700/60 rounded-xl p-1 text-sm">
          {(['login', 'register'] as Mode[]).map(m => (
            <button
              type="button"
              key={m}
              onClick={() => { setMode(m); setErr(null); }}
              className={`flex-1 py-2 rounded-lg transition relative capitalize ${
                mode === m ? 'text-ink-900 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {mode === m && (
                <motion.div layoutId="modeBg" className="absolute inset-0 bg-neon-cyan rounded-lg -z-10" />
              )}
              {m}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'login' ? -10 : 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mode === 'login' ? 10 : -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-3"
          >
            {mode === 'register' && (
              <>
                <Field label="Name">
                  <input
                    className="w-full bg-ink-700/70 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-neon-cyan/60"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Jane Doe"
                    required
                  />
                </Field>
                <Field label="Role">
                  <select
                    className="w-full bg-ink-700/70 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-neon-cyan/60"
                    value={role}
                    onChange={e => setRole(e.target.value)}
                  >
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Email">
              <input
                type="email"
                className="w-full bg-ink-700/70 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-neon-cyan/60"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                className="w-full bg-ink-700/70 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-neon-cyan/60"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </Field>
          </motion.div>
        </AnimatePresence>

        {err && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-neon-pink text-sm">
            {err}
          </motion.p>
        )}

        <Button type="submit" size="lg" loading={loading} className="w-full">
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </Button>

        <p className="text-[11px] text-slate-500 text-center">
          By continuing you agree to the prototype terms — no real medical decisions.
        </p>
      </motion.form>
    </div>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1">
    <span className="text-[11px] uppercase tracking-wider text-slate-400">{label}</span>
    {children}
  </label>
);
