import { FirstAidKit, Headset, MagnifyingGlass, Stethoscope, User, UserPlus, UsersThree, type Icon } from '@phosphor-icons/react';
import { KPI } from '../../../../components/widgets/KPI';
import { cn } from '../../../../lib/utils';
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
import { useSelector } from 'react-redux';
import type { RootState } from '../../../../store';

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

const ROLE_TILE: Record<string, [Icon, TileTone]> = {
  eso: [Headset, 'teal'],
  doctor: [Stethoscope, 'blue'],
  nurse: [FirstAidKit, 'blue'],
  student_responder: [FirstAidKit, 'amber'],
  citizen: [User, 'slate'],
};

type Group = 'operators' | 'responders' | 'citizens';
const GROUPS: [Group, string][] = [['operators', 'Operators'], ['responders', 'Responders'], ['citizens', 'Citizens']];

export const AdminUsers = () => {
  const me = useSelector((s: RootState) => s.auth.user);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [creating, setCreating] = useState(false);
  const [group, setGroup] = useState<Group>('operators');
  const [query, setQuery] = useState('');
  const [showNew, setShowNew] = useState(false);

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

  const createOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/admin/operators', { email, password, firstName, lastName });
      pushToast({ tone: 'success', title: 'Operator created', body: email });
      setEmail(''); setPassword(''); setFirstName(''); setLastName(''); setShowNew(false); setGroup('operators');
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Create failed', body: err.response?.data?.error ?? 'Could not create the operator' });
    } finally {
      setCreating(false);
    }
  };

  const groupOf = (role: string): Group => (role === 'eso' ? 'operators' : role === 'citizen' ? 'citizens' : 'responders');
  const counts = { operators: 0, responders: 0, citizens: 0 } as Record<Group, number>;
  users.forEach(u => { counts[groupOf(u.role)]++; });
  const q = query.trim().toLowerCase();
  const shown = users.filter(u => groupOf(u.role) === group && (!q || `${u.name} ${u.email}`.toLowerCase().includes(q)));

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
      <PageHeader icon={UsersThree} title="Users" subtitle="Operators, responders and citizens on the Vitalis network." actions={<Button onClick={() => setShowNew(v => !v)} className="rounded-xl bg-white text-primary hover:bg-white/90 h-10 px-4 font-semibold"><UserPlus size={18} weight="bold" /> New operator</Button>} />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-3 gap-4 stagger">
          <KPI icon={Headset} iconTone="deep" label="Emergency services operators" value={counts.operators} />
          <KPI icon={FirstAidKit} iconTone="teal" label="Responders (clinicians and certified)" value={counts.responders} />
          <KPI icon={User} iconTone="mint" label="Citizens" value={counts.citizens} />
        </div>
        {showNew && (
        <Panel title="New operator account" aside={<button onClick={() => setShowNew(false)} className="text-sm text-muted-foreground hover:text-foreground">Close</button>}>
          <div className="p-5">
            <form onSubmit={createOperator} className="grid grid-cols-2 gap-4">
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
                <Button type="submit" loading={creating} className="rounded-lg">Create operator</Button>
              </div>
            </form>
          </div>
        </Panel>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-sm" role="tablist">
            {GROUPS.map(([g, label]) => (
              <button key={g} role="tab" aria-selected={group === g} onClick={() => setGroup(g)}
                className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', group === g ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}>
                {label} <span className="num opacity-70">{counts[g]}</span>
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-[min(320px,100%)]">
            <span className="sr-only">Search users</span>
            <MagnifyingGlass size={17} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or email" className="w-full h-10 rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20 transition" />
          </label>
        </div>
        <Panel>
          {loading && <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>}
          {!loading && shown.length === 0 && <p className="px-5 py-10 text-center text-muted-foreground">{query ? `Nobody matches “${query}”.` : 'Nobody in this group yet.'}</p>}
          {shown.map(u => {
            const [icon, tone] = ROLE_TILE[u.role] ?? ROLE_TILE.citizen;
            return (
              <Row
                key={u._id}
                icon={icon}
                tone={tone}
                title={<Link to={`/command/admin/users/${u._id}`} className="hover:underline underline-offset-2">{u.name}</Link>}
                summary={u.email}
                right={<>
                  <Chip tone={u.role === 'eso' ? 'teal' : 'muted'}>{u.role === 'eso' ? 'ESO' : <span className="capitalize">{u.role.replace('_', ' ')}</span>}</Chip>
                  <Link to={`/command/admin/users/${u._id}`}><Button variant="outline" size="sm" className="rounded-lg">View</Button></Link>
                  {u._id !== me?.id ? <Button variant="ghost" size="sm" className="rounded-lg text-muted-foreground hover:text-destructive" onClick={() => remove(u._id)}>Remove</Button> : null}
                </>}
              />
            );
          })}
        </Panel>
      </div>
    </>
  );
};
