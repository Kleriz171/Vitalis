import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../components/ui/select';
import { pushToast } from '../../components/toast/toast';
import { cn } from '../../lib/utils';

type Mode = 'login' | 'register';

const ROLES = [
  { value: 'dispatcher', label: 'Dispatcher' },
  { value: 'admin', label: 'Admin' },
];

const OPERATOR_ROLES = ['dispatcher', 'admin'];

export const Login = () => {
  const [params] = useSearchParams();
  const [mode, setMode] = useState<Mode>(params.get('mode') === 'register' ? 'register' : 'login');
  const [email, setEmail] = useState('dispatcher@vitalis.dev');
  const [password, setPassword] = useState('demo1234');
  const [name, setName] = useState('');
  const [role, setRole] = useState('dispatcher');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const dispatch = useDispatch();
  const nav = useNavigate();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
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
      pushToast({
        tone: 'success',
        title: mode === 'login' ? 'Welcome back' : 'Account created',
        body: data.user.email,
      });
      nav('/command');
    } catch (e: any) {
      const msg = e.response?.data?.error ?? `${mode} failed`;
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
            <div className="flex bg-muted rounded-xl p-1 text-sm">
              {(['login', 'register'] as Mode[]).map(m => (
                <button
                  type="button"
                  key={m}
                  onClick={() => { setMode(m); setErr(null); }}
                  className={cn(
                    'flex-1 py-2 rounded-lg transition capitalize font-medium',
                    mode === m ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {m === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

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
                {mode === 'login' ? 'Sign in' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center mt-6">
          By continuing you agree to the prototype terms — no real medical decisions.
        </p>
      </div>
    </div>
  );
};
