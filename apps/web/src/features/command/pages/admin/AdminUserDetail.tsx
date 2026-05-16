import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Heart, Pill, Syringe, AlertTriangle, Calendar, Activity, Award, Stethoscope } from 'lucide-react';
import { api } from '../../../../api/client';
import { PageHeader } from '../../../../components/layout/CommandShell';
import { Card, CardContent, CardHeader } from '../../../../components/ui/card';
import { Badge } from '../../../../components/ui/badge';

interface UserDetail {
  user: {
    _id: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    role: string;
    bloodType?: string;
    age?: number;
    gender?: string;
    heightCm?: number;
    weightKg?: number;
    phone?: string;
    illnesses?: string[];
    disabilities?: string[];
    createdAt: string;
  };
  medications: Array<{ _id: string; name: string; dosage?: string; isActive: boolean }>;
  allergies: Array<{ _id: string; allergen: string; severity: string }>;
  vaccinations: Array<{ _id: string; name: string; date?: string; provider?: string }>;
  appointments: Array<{ _id: string; appointmentType: string; scheduledAt: string; status: string; notes?: string }>;
  conditions: Array<{ _id: string; name: string; notes?: string }>;
  disabilities: Array<{ _id: string; name: string; notes?: string }>;
  emergencies: Array<{ _id: string; type: string; priority: number; status: string; createdAt: string; description?: string; etaSeconds?: number }>;
  certifications: Array<{ _id: string; badgeLabel: string; score: number; issuedAt: string; expiresAt: string }>;
  enrollments: Array<{ _id: string; lastScore?: number; attempts: number; completedAt?: string }>;
}

const fmt = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const AdminUserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    api.get<UserDetail>(`/admin/users/${id}`).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  if (!data) return <div className="p-8 text-sm text-muted-foreground">User not found.</div>;

  const u = data.user;
  const activeCerts = data.certifications.filter(c => new Date(c.expiresAt).getTime() > Date.now());

  return (
    <>
      <PageHeader
        title={u.name}
        subtitle={`${u.email} · ${u.role}`}
        actions={
          <Link to="/command/admin/users" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft size={14} /> Back to users
          </Link>
        }
      />
      <div className="p-8 space-y-6">
        <div className="grid md:grid-cols-4 gap-3">
          <Kpi label="Blood type" value={u.bloodType ?? '—'} accent="text-rose-600" />
          <Kpi label="Age" value={u.age != null ? `${u.age}` : '—'} />
          <Kpi label="Active certs" value={activeCerts.length} accent="text-emerald-600" />
          <Kpi label="SOS history" value={data.emergencies.length} accent="text-primary" />
        </div>

        <Card>
          <CardHeader className="px-5 py-4 border-b">
            <div className="font-semibold flex items-center gap-2"><Heart size={16} /> Profile</div>
          </CardHeader>
          <CardContent className="p-5 grid md:grid-cols-3 gap-4 text-sm">
            <Field label="First name" value={u.firstName ?? '—'} />
            <Field label="Last name" value={u.lastName ?? '—'} />
            <Field label="Phone" value={u.phone ?? '—'} />
            <Field label="Gender" value={u.gender ?? '—'} />
            <Field label="Height" value={u.heightCm ? `${u.heightCm} cm` : '—'} />
            <Field label="Weight" value={u.weightKg ? `${u.weightKg} kg` : '—'} />
            <Field label="Joined" value={fmt(u.createdAt)} />
            <Field label="Illnesses (profile)" value={(u.illnesses ?? []).join(', ') || '—'} />
            <Field label="Disabilities (profile)" value={(u.disabilities ?? []).join(', ') || '—'} />
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-2 gap-4">
          <Section title="Medications" icon={<Pill size={16} />} empty={!data.medications.length}>
            {data.medications.map(m => (
              <Row key={m._id} title={m.name} subtitle={m.dosage || (m.isActive ? 'Active' : 'Ended')} />
            ))}
          </Section>

          <Section title="Allergies" icon={<AlertTriangle size={16} />} empty={!data.allergies.length}>
            {data.allergies.map(a => (
              <Row key={a._id} title={a.allergen} badge={<Badge variant={a.severity === 'severe' ? 'destructive' : 'outline'}>{a.severity}</Badge>} />
            ))}
          </Section>

          <Section title="Vaccinations" icon={<Syringe size={16} />} empty={!data.vaccinations.length}>
            {data.vaccinations.map(v => (
              <Row key={v._id} title={v.name} subtitle={[v.provider, fmt(v.date)].filter(Boolean).join(' · ')} />
            ))}
          </Section>

          <Section title="Conditions" icon={<Activity size={16} />} empty={!data.conditions.length}>
            {data.conditions.map(c => (
              <Row key={c._id} title={c.name} subtitle={c.notes} />
            ))}
          </Section>

          <Section title="Appointments" icon={<Calendar size={16} />} empty={!data.appointments.length}>
            {data.appointments.map(a => (
              <Row key={a._id} title={a.appointmentType} subtitle={`${fmt(a.scheduledAt)} · ${a.status}`} />
            ))}
          </Section>

          <Section title="Disabilities" icon={<Stethoscope size={16} />} empty={!data.disabilities.length}>
            {data.disabilities.map(d => (
              <Row key={d._id} title={d.name} subtitle={d.notes} />
            ))}
          </Section>
        </div>

        <Card>
          <CardHeader className="px-5 py-4 border-b">
            <div className="font-semibold flex items-center gap-2"><Award size={16} /> Training certifications ({data.certifications.length})</div>
          </CardHeader>
          <CardContent className="p-5">
            {data.certifications.length ? (
              <div className="space-y-2">
                {data.certifications.map(c => {
                  const active = new Date(c.expiresAt).getTime() > Date.now();
                  return (
                    <div key={c._id} className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
                      <div>
                        <div className="font-medium">{c.badgeLabel}</div>
                        <div className="text-xs text-muted-foreground">Score {c.score}% · Issued {fmt(c.issuedAt)} · Expires {fmt(c.expiresAt)}</div>
                      </div>
                      <Badge variant={active ? 'default' : 'outline'}>{active ? 'Active' : 'Expired'}</Badge>
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-sm text-muted-foreground">No certifications earned.</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="px-5 py-4 border-b">
            <div className="font-semibold">SOS / emergency history ({data.emergencies.length})</div>
          </CardHeader>
          <CardContent className="p-5">
            {data.emergencies.length ? (
              <div className="space-y-2">
                {data.emergencies.map(e => (
                  <div key={e._id} className="border border-border rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="font-medium capitalize">{e.type.replace('_', ' ')} <span className="text-xs uppercase tracking-wide text-muted-foreground ml-2">P{e.priority}</span></div>
                      <Badge variant={e.status === 'resolved' ? 'outline' : 'destructive'}>{e.status.replace('_', ' ')}</Badge>
                    </div>
                    {e.description ? <div className="text-xs text-muted-foreground mt-1">{e.description}</div> : null}
                    <div className="text-xs text-muted-foreground mt-1">Triggered {fmt(e.createdAt)}{e.etaSeconds ? ` · ETA ${e.etaSeconds}s` : ''}</div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-muted-foreground">No emergency history.</p>}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

const Kpi = ({ label, value, accent }: { label: string; value: number | string; accent?: string }) => (
  <Card className="gap-0 py-0">
    <CardContent className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${accent ?? 'text-foreground'}`}>{value}</div>
    </CardContent>
  </Card>
);

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="mt-0.5">{value}</div>
  </div>
);

const Section = ({ title, icon, empty, children }: { title: string; icon?: React.ReactNode; empty: boolean; children: React.ReactNode }) => (
  <Card className="gap-0 py-0">
    <CardHeader className="px-5 py-4 border-b">
      <div className="font-semibold flex items-center gap-2">{icon}{title}</div>
    </CardHeader>
    <CardContent className="p-5 space-y-2">
      {empty ? <p className="text-sm text-muted-foreground">None on file.</p> : children}
    </CardContent>
  </Card>
);

const Row = ({ title, subtitle, badge }: { title: string; subtitle?: string; badge?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-3 border-b border-border last:border-b-0 pb-2 last:pb-0">
    <div className="min-w-0">
      <div className="text-sm font-medium truncate">{title}</div>
      {subtitle ? <div className="text-xs text-muted-foreground truncate">{subtitle}</div> : null}
    </div>
    {badge ? <div className="shrink-0">{badge}</div> : null}
  </div>
);
