import { Heart } from '@phosphor-icons/react';
import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { pushToast } from '../../components/toast/toast';
import { ConvergeMap } from '../../components/widgets/ConvergeMap';

// The console is for emergency services operators ('eso'); older sessions may still say dispatcher/admin.
const OPERATOR_ROLES = ['eso', 'dispatcher', 'admin'];
// Seeded demo accounts, dev builds only. Vite drops this array from production bundles.
const DEMO_OPERATOR_ACCOUNTS = import.meta.env.DEV
  ? [
      { label: 'Emergency services operator', email: 'aleks@vitalis.com', password: 'AlexNo11$' },
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
      nav('/command');
    } catch (e: any) {
      const msg = e.response?.data?.error ?? 'Sign in failed';
      setErr(msg);
      pushToast({ tone: 'error', title: 'Error', body: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] frame-texture">
      <section className="hidden lg:flex flex-col justify-between p-10 text-white">
        <Brand />
        <div className="max-w-[560px]">
          <ConvergeMap className="w-full max-w-[520px] -ml-3" />
          <h1 className="mt-6 text-[38px] font-extrabold leading-[1.08] tracking-[-0.03em] text-balance">Every call, every responder, every defibrillator on one screen.</h1>
          <p className="mt-3 text-[15px] text-white/75 max-w-[46ch] text-pretty">Live SOS intake, responder tracking and patient handover for dispatch centres and hospital coordinators.</p>
        </div>
        <p className="text-[13px] text-white/55">Authorised operators only. Every action is recorded in the ledger.</p>
      </section>

      <section className="flex items-center justify-center p-6 lg:p-10">
        <div className="w-full max-w-[400px] rounded-[20px] bg-background p-8 shadow-[0_30px_80px_-30px_hsl(176_60%_6%/0.6)]">
          <div className="lg:hidden mb-6"><Brand dark /></div>
          <h2 className="text-[26px] font-extrabold tracking-[-0.025em]">Sign in</h2>
          <p className="text-[14px] text-muted-foreground mt-1 mb-7">Use your emergency services operator (ESO) account.</p>

          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required autoFocus className="h-11 bg-white" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required className="h-11 bg-white" />
            </div>
            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
            <Button type="submit" size="lg" loading={loading} className="w-full h-11 rounded-xl text-[15px]">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {DEMO_OPERATOR_ACCOUNTS.length > 0 && (
            <div className="mt-7 pt-6 border-t border-border">
              <p className="text-[13px] text-muted-foreground">Demo account, development only</p>
              <div className="mt-2.5 grid gap-2">
                {DEMO_OPERATOR_ACCOUNTS.map(account => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => { setEmail(account.email); setPassword(account.password); setErr(null); }}
                    className="rounded-xl border border-border bg-white px-3 py-2.5 text-left text-sm transition hover:border-primary/50 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

const Brand = ({ dark = false }: { dark?: boolean }) => (
  <div className="flex items-center gap-2.5">
    <div className="w-9 h-9 rounded-xl bg-[hsl(var(--teal))] grid place-items-center text-white">
      <Heart size={20} weight="fill" />
    </div>
    <div className="leading-none">
      <div className={`text-[20px] font-extrabold tracking-[-0.02em] ${dark ? 'text-foreground' : 'text-white'}`}>Vitalis</div>
      <div className={`text-[12px] mt-0.5 ${dark ? 'text-muted-foreground' : 'text-white/65'}`}>Command</div>
    </div>
  </div>
);
