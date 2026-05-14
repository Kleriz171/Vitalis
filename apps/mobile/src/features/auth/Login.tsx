import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart } from 'lucide-react';
import { api } from '../../api/client';
import { setSession } from '../../store';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Card, CardContent } from '../../components/ui/card';
import { Alert, AlertDescription } from '../../components/ui/alert';
import { pushToast } from '../../components/toast/toast';
import { cn } from '@/lib/utils';

type Mode = 'login' | 'register';

const ROLES = [
  { value: 'citizen', label: 'Citizen' },
  { value: 'blood_donor', label: 'Blood donor' },
  { value: 'doctor', label: 'Doctor (field)' },
  { value: 'nurse', label: 'Nurse (field)' },
  { value: 'student_responder', label: 'Student responder' },
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
    setLoading(true);
    setErr(null);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const body = mode === 'login' ? { email, password } : { email, password, name, role };
      const { data } = await api.post(endpoint, body);

      if (OPERATOR_ROLES.includes(data.user.role)) {
        setErr('Operators must use the desktop portal.');
        pushToast({ tone: 'warn', title: 'Wrong app', body: 'Open the desktop operator portal.' });
        setLoading(false);
        return;
      }

      dispatch(setSession(data));
      pushToast({
        tone: 'success',
        title: mode === 'login' ? 'Welcome back' : 'Account created',
        body: data.user.email,
      });
      nav('/app');
    } catch (e: any) {
      const msg = e.response?.data?.error ?? `${mode} failed`;
      setErr(msg);
      pushToast({ tone: 'error', title: 'Error', body: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-container">
      <div className="mobile-content-full scrollbar-hide">
        <div className="min-h-full px-6 pt-6 pb-10 flex flex-col">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} /> Back
          </Link>

          <div className="flex items-center gap-3 mt-6 mb-6">
            <div className="w-11 h-11 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-sm">
              <Heart size={20} fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-wide">VITALIS</h1>
              <p className="text-xs text-muted-foreground">Bio-logistics access</p>
            </div>
          </div>

          <Card className="border-border shadow-sm">
            <CardContent className="space-y-5">
              <div className="flex bg-muted rounded-xl p-1 text-sm">
                {(['login', 'register'] as Mode[]).map(m => (
                  <button
                    type="button"
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setErr(null);
                    }}
                    className={cn(
                      'flex-1 py-2 rounded-lg transition capitalize font-medium',
                      mode === m
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
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
                      <Input
                        id="name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Jane Doe"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Role</Label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    minLength={8}
                    required
                  />
                </div>

                {err && (
                  <Alert variant="destructive">
                    <AlertDescription>{err}</AlertDescription>
                  </Alert>
                )}

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
    </div>
  );
};
