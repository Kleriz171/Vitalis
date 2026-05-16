import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../../api/client';
import { PageHeader } from '../../../../components/layout/CommandShell';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { Card, CardContent } from '../../../../components/ui/card';
import { pushToast } from '../../../../components/toast/toast';

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

export const AdminUsers = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get<AdminUser[]>('/admin/users');
      setUsers(data);
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Load failed', body: e.response?.data?.error ?? 'Could not load users' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const createDispatcher = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/dispatchers', { email, password, firstName, lastName });
      pushToast({ tone: 'success', title: 'Dispatcher created', body: email });
      setEmail(''); setPassword(''); setFirstName(''); setLastName('');
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Create failed', body: err.response?.data?.error ?? 'Could not create dispatcher' });
    } finally {
      setCreating(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/admin/users/${id}`);
      pushToast({ tone: 'success', title: 'User removed' });
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Remove failed', body: err.response?.data?.error ?? 'Could not remove user' });
    }
  };

  return (
    <>
      <PageHeader title="User management" subtitle="Create dispatcher accounts and manage existing users." />
      <div className="p-8 space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="text-lg font-bold">Create dispatcher</h2>
            <form onSubmit={createDispatcher} className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" value={firstName} onChange={e => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" value={lastName} onChange={e => setLastName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="em">Email</Label>
                <Input id="em" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pw">Password</Label>
                <Input id="pw" type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="col-span-2">
                <Button type="submit" loading={creating}>Create dispatcher</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-lg font-bold">All users ({users.length})</h2>
            {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
            <div className="space-y-2">
              {users.map(u => (
                <div key={u._id} className="flex items-center justify-between gap-4 border border-border rounded-lg px-4 py-3 hover:bg-muted/40 transition">
                  <Link to={`/command/admin/users/${u._id}`} className="flex-1 min-w-0">
                    <div className="font-medium">{u.name} <span className="text-xs uppercase tracking-wide text-muted-foreground ml-2">{u.role}</span></div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </Link>
                  <div className="flex gap-2 shrink-0">
                    <Link to={`/command/admin/users/${u._id}`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                    {u.role !== 'admin' ? (
                      <Button variant="outline" size="sm" onClick={() => remove(u._id)}>Remove</Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};
