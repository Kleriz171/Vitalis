import { FirstAidKit, Headset, ShieldStar, Stethoscope, User, UsersThree, type Icon } from '@phosphor-icons/react';
import type { TileTone } from '../../../../components/ui/tile';
import { Chip, Panel, Row } from '../../../../components/ui/list';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../../api/client';
import { PageHeader } from '../../../../components/layout/CommandShell';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Label } from '../../../../components/ui/label';
import { pushToast } from '../../../../components/toast/toast';

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLE_TILE: Record<string, [Icon, TileTone]> = {
  admin: [ShieldStar, 'violet'],
  dispatcher: [Headset, 'teal'],
  doctor: [Stethoscope, 'blue'],
  nurse: [FirstAidKit, 'blue'],
  student_responder: [FirstAidKit, 'amber'],
  citizen: [User, 'slate'],
};

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
      <PageHeader icon={UsersThree} title="User management" subtitle="Create dispatcher accounts and manage existing users." />
      <div className="p-6 space-y-5">
        <Panel title="New dispatcher account">
          <div className="p-5">
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
                <Button type="submit" loading={creating} className="rounded-lg">Create dispatcher</Button>
              </div>
            </form>
          </div>
        </Panel>

        <Panel title={`All users (${users.length})`} aside={loading ? <span className="text-sm text-muted-foreground">Loading…</span> : null}>
          {users.map(u => {
            const [icon, tone] = ROLE_TILE[u.role] ?? ROLE_TILE.citizen;
            return (
              <Row
                key={u._id}
                icon={icon}
                tone={tone}
                title={<Link to={`/command/admin/users/${u._id}`} className="hover:underline underline-offset-2">{u.name}</Link>}
                summary={u.email}
                right={<>
                  <Chip tone={u.role === 'admin' || u.role === 'dispatcher' ? 'teal' : 'muted'}><span className="capitalize">{u.role.replace('_', ' ')}</span></Chip>
                  <Link to={`/command/admin/users/${u._id}`}><Button variant="outline" size="sm" className="rounded-lg">View</Button></Link>
                  {u.role !== 'admin' ? <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground hover:text-destructive" onClick={() => remove(u._id)}>Remove</Button> : null}
                </>}
              />
            );
          })}
        </Panel>
      </div>
    </>
  );
};
