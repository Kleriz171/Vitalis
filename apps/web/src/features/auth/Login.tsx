import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { pushToast } from '../../components/toast/toast';

const OPERATOR_ROLES = ['dispatcher', 'admin'];
const DEMO_OPERATOR_ACCOUNTS = [
  {
    label: 'Dispatcher',
    email: 'dispatcher@vitalis.com',
    password: 'Dispatch1!',
  },
  {
    label: 'Admin',
    email: 'aleks@vitalis.com',
    password: 'AlexNo11$',
  },
];

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
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft size={16} /> Home
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <Heart size={20} fill="currentColor" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold tracking-wide">VITALIS</h1>
            <p className="text-xs text-muted-foreground">Operator portal access</p>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardContent className="space-y-5">
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} required />
              </div>

              {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

              <Button type="submit" size="lg" loading={loading} className="w-full">
                Sign in
              </Button>
            </form>

            <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground">Demo operator accounts</p>
                <p className="text-xs text-muted-foreground">Use one of these seeded accounts to enter the command portal.</p>
              </div>
              <div className="space-y-2">
                {DEMO_OPERATOR_ACCOUNTS.map((account) => (
                  <button
                    key={account.email}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(account.password);
                      setErr(null);
                    }}
                    className="w-full rounded-xl border border-border bg-card px-3 py-3 text-left transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm font-semibold text-foreground">{account.label}</span>
                      <span className="text-[11px] font-medium text-primary">Use account</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{account.email}</div>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
