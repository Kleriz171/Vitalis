import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { pushToast } from '../../components/toast/toast';

const OPERATOR_ROLES = ['dispatcher', 'admin'];
// Seeded demo accounts, dev builds only. Vite drops this array from production bundles.
const DEMO_OPERATOR_ACCOUNTS = import.meta.env.DEV
  ? [
      { label: 'Dispatcher', email: 'dispatcher@vitalis.com', password: 'Dispatch1!' },
      { label: 'Admin', email: 'aleks@vitalis.com', password: 'AlexNo11$' },
    ]
  : [];

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const { data } = await api.post('/auth/login', { email, password });

      if (!OPERATOR_ROLES.includes(data.user.role)) {
        setErr('This portal is for operators. Use the mobile app instead.');
        pushToast({ tone: 'warn', title: 'Wrong portal', body: 'Citizens use the mobile app.' });
        setLoading(false);
        return;
      }

      dispatch(setSession(data));
      pushToast({ tone: 'success', title: 'Welcome back', body: data.user.email });
      nav(data.user.role === 'admin' ? '/command/admin/users' : '/command');
    } catch (e: any) {
      const msg = e.response?.data?.error ?? 'Sign in failed';
      setErr(msg);
      pushToast({ tone: 'error', title: 'Error', body: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] bg-background">
      <section className="hidden lg:flex flex-col justify-between p-12 bg-[hsl(193_47%_12%)] text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary grid place-items-center">
            <Heart size={18} fill="currentColor" />
          </div>
          <span className="text-lg font-bold">Vitalis Command</span>
        </div>
        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-bold leading-tight text-balance">Every call, every responder, every defibrillator on one screen.</h1>
          <p className="text-white/80 text-pretty">
            Live SOS intake, responder tracking and patient handover for dispatch centres and hospital coordinators.
          </p>
        </div>
        <p className="text-xs text-white/60">Authorised operators only.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Heart size={18} fill="currentColor" />
            </div>
            <span className="text-lg font-bold">Vitalis Command</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-8">Use your dispatcher or administrator account.</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
            </div>
            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
            <Button type="submit" size="lg" loading={loading} className="w-full">Sign in</Button>
          </form>

          {DEMO_OPERATOR_ACCOUNTS.length > 0 && (
            <div className="mt-8 pt-6 border-t border-border">
              <p className="text-sm font-medium">Demo accounts <span className="text-muted-foreground font-normal">(development only)</span></p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {DEMO_OPERATOR_ACCOUNTS.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword(account.password); setErr(null); }}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm transition hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="font-medium">{account.label}</div>
                    <div className="text-xs text-muted-foreground truncate">{account.email}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
