import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Heart, Lock } from 'lucide-react';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { pushToast } from '../../components/toast/toast';
import { Radar } from '../../components/widgets/Radar';

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
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] scanlines">
      <section className="hidden lg:flex flex-col justify-between p-10 border-r border-border relative overflow-hidden">
        <Brand />
        <div className="flex flex-col xl:flex-row items-start xl:items-center gap-8 xl:gap-12">
          <Radar className="w-[220px] xl:w-[360px]" />
          <div className="max-w-sm space-y-4">
            <div className="hud-label flex items-center gap-2"><span className="w-3 h-px bg-primary" /> Tirana dispatch network</div>
            <h1 className="text-[34px] font-semibold leading-[1.15] text-balance">Every call, every responder, every defibrillator on one screen.</h1>
            <p className="text-muted-foreground text-pretty">Live SOS intake, responder tracking and patient handover for dispatch centres and hospital coordinators.</p>
          </div>
        </div>
        <div className="font-mono text-[11px] tracking-wider text-muted-foreground/70 flex gap-6">
          <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--glow))]" /> SYSTEM READY</span>
          <span>TLS ENCRYPTED</span>
          <span>AUTHORISED OPERATORS ONLY</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8"><Brand /></div>
          <div className="hud-panel rounded-md border border-border p-7">
            <div className="hud-label flex items-center gap-2"><Lock size={12} className="text-primary" /> Secure operator access</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="text-sm text-muted-foreground mt-1 mb-6">Use your dispatcher or administrator account.</p>

            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="hud-label">Email</Label>
                <Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus className="h-10 font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="hud-label">Password</Label>
                <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required className="h-10 font-mono" />
              </div>
              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
              <Button type="submit" size="lg" loading={loading} className="w-full font-mono tracking-[0.15em] uppercase shadow-[0_0_24px_-4px_hsl(var(--glow)/0.6)]">
                {loading ? 'Verifying…' : 'Sign in'}
              </Button>
            </form>
          </div>

          {DEMO_OPERATOR_ACCOUNTS.length > 0 && (
            <div className="mt-6">
              <p className="hud-label">Demo accounts · development only</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {DEMO_OPERATOR_ACCOUNTS.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword(account.password); setErr(null); }}
                    className="rounded-sm border border-border bg-card/60 px-3 py-2 text-left text-sm transition hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="font-medium">{account.label}</div>
                    <div className="text-xs text-muted-foreground truncate font-mono">{account.email}</div>
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

const Brand = () => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-sm border border-primary/60 bg-primary/10 grid place-items-center text-primary shadow-[0_0_16px_hsl(var(--glow)/0.5)]">
      <Heart size={16} fill="currentColor" />
    </div>
    <div className="font-mono text-sm tracking-[0.25em]">
      <span className="font-semibold">VITALIS</span><span className="text-primary"> / </span><span className="text-muted-foreground">COMMAND</span>
    </div>
  </div>
);
