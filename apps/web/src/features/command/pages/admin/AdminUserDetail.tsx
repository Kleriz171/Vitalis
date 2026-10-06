import { Drop, Siren, User, ArrowLeft, CalendarBlank, Certificate, Heart, IdentificationCard, Pill, Pulse, Stethoscope, Syringe, Warning } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../../api/client';
import { KPI } from '../../../../components/widgets/KPI';
import { PageHeader } from '../../../../components/layout/CommandShell';
import { Panel, Row as ListRow, Chip } from '../../../../components/ui/list';

interface UserDetail {
  user: {
    _id: string;
    email?: string;
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
      <PageHeader icon={IdentificationCard}
        title={u.name}
        subtitle={`${u.phone ?? u.email ?? 'No contact'} · ${u.role === 'eso' ? 'Operator' : u.role.replace('_', ' ')}`}
        actions={
          <Link to="/command/admin/users" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white/[0.12] text-white text-sm font-medium hover:bg-white/[0.2] transition-colors">
            <ArrowLeft size={14} /> Back to users
          </Link>
        }
      />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 stagger">
          <KPI icon={Drop} iconTone="teal" label="Blood type" value={u.bloodType ?? '—'} />
          <KPI icon={User} iconTone="teal" label="Age" value={u.age != null ? `${u.age}` : '—'} />
          <KPI icon={Certificate} iconTone="mint" label="Active certificates" value={activeCerts.length} />
          <KPI icon={Siren} iconTone="deep" label="SOS calls sent" value={data.emergencies.length} />
        </div>

        <Section title="Profile" icon={<Heart size={18} weight="duotone" />} empty={false}>
          <div className="grid md:grid-cols-3 gap-x-6 gap-y-4 text-sm">
            <Field label="First name" value={u.firstName ?? '—'} />
            <Field label="Last name" value={u.lastName ?? '—'} />
            <Field label="Phone" value={u.phone ?? '—'} />
            <Field label="Gender" value={u.gender ?? '—'} />
            <Field label="Height" value={u.heightCm ? `${u.heightCm} cm` : '—'} />
            <Field label="Weight" value={u.weightKg ? `${u.weightKg} kg` : '—'} />
            <Field label="Joined" value={fmt(u.createdAt)} />
            <Field label="Illnesses (profile)" value={(u.illnesses ?? []).join(', ') || '—'} />
            <Field label="Disabilities (profile)" value={(u.disabilities ?? []).join(', ') || '—'} />
          </div>
        </Section>

        <div className="grid lg:grid-cols-2 gap-4">
          <Section title="Medications" icon={<Pill size={18} weight="duotone" />} empty={!data.medications.length}>
            {data.medications.map(m => (
              <Row key={m._id} title={m.name} subtitle={m.dosage || (m.isActive ? 'Active' : 'Ended')} />
            ))}
          </Section>

          <Section title="Allergies" icon={<Warning size={18} weight="duotone" />} empty={!data.allergies.length}>
            {data.allergies.map(a => (
              <Row key={a._id} title={a.allergen} badge={<Chip tone={a.severity === 'severe' ? 'sos' : 'muted'}>{a.severity}</Chip>} />
            ))}
          </Section>

          <Section title="Vaccinations" icon={<Syringe size={18} weight="duotone" />} empty={!data.vaccinations.length}>
            {data.vaccinations.map(v => (
              <Row key={v._id} title={v.name} subtitle={[v.provider, fmt(v.date)].filter(Boolean).join(' · ')} />
            ))}
          </Section>

          <Section title="Conditions" icon={<Pulse size={18} weight="duotone" />} empty={!data.conditions.length}>
            {data.conditions.map(c => (
              <Row key={c._id} title={c.name} subtitle={c.notes} />
            ))}
          </Section>

          <Section title="Appointments" icon={<CalendarBlank size={18} weight="duotone" />} empty={!data.appointments.length}>
            {data.appointments.map(a => (
              <Row key={a._id} title={a.appointmentType} subtitle={`${fmt(a.scheduledAt)} · ${a.status}`} />
            ))}
          </Section>

          <Section title="Disabilities" icon={<Stethoscope size={18} weight="duotone" />} empty={!data.disabilities.length}>
            {data.disabilities.map(d => (
              <Row key={d._id} title={d.name} subtitle={d.notes} />
            ))}
          </Section>
        </div>

        <Panel title={`Training certificates · ${data.certifications.length}`}>
          {data.certifications.length ? data.certifications.map(c => {
            const active = new Date(c.expiresAt).getTime() > Date.now();
            return (
              <ListRow key={c._id} icon={Certificate} tone={active ? 'mint' : 'teal'} title={c.badgeLabel}
                summary={`Score ${c.score}% · Issued ${fmt(c.issuedAt)} · Expires ${fmt(c.expiresAt)}`}
                right={<Chip tone={active ? 'teal' : 'muted'}>{active ? 'Active' : 'Expired'}</Chip>} />
            );
          }) : <p className="px-5 py-4 text-sm text-muted-foreground">No certificates earned.</p>}
        </Panel>

        <Panel title={`SOS history · ${data.emergencies.length}`}>
          {data.emergencies.length ? data.emergencies.map(e => (
            <ListRow key={e._id} icon={Siren} tone={e.status === 'resolved' ? 'teal' : 'sos'}
              title={<span className="capitalize">{e.type.replace('_', ' ')} <span className="text-xs font-medium text-muted-foreground ml-1">Priority {e.priority}</span></span>}
              summary={[e.description, `Sent ${fmt(e.createdAt)}`, e.etaSeconds ? `ETA ${Math.round(e.etaSeconds / 60)} min` : null].filter(Boolean).join(' · ')}
              right={<Chip tone={e.status === 'resolved' ? 'muted' : 'sos'}>{e.status.replace('_', ' ')}</Chip>} />
          )) : <p className="px-5 py-4 text-sm text-muted-foreground">No SOS calls.</p>}
        </Panel>
      </div>
    </>
  );
};

const Field = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[11px] text-muted-foreground">{label}</div>
    <div className="mt-0.5">{value}</div>
  </div>
);

const Section = ({ title, icon, empty, children }: { title: string; icon?: React.ReactNode; empty: boolean; children: React.ReactNode }) => (
  <section className="rounded-[22px] border border-border bg-card shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
    <header className="flex items-center gap-3 px-5 pt-4 pb-3 border-b border-border">
      <span className="w-8 h-8 rounded-[10px] grid place-items-center bg-[hsl(173_55%_92%)] text-[hsl(175_77%_24%)]">{icon}</span>
      <h2 className="text-[15px] font-extrabold tracking-[-0.01em]">{title}</h2>
    </header>
    <div className="p-5 space-y-2">
      {empty ? <p className="text-sm text-muted-foreground">None on file.</p> : children}
    </div>
  </section>
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
