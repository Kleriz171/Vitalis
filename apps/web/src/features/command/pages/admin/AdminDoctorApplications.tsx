import { ArrowSquareOut, CheckCircle, EnvelopeSimple, FilePdf, IdentificationCard, Phone, XCircle } from '@phosphor-icons/react';
import { Tile } from '../../../../components/ui/tile';
import { Chip } from '../../../../components/ui/list';
import { cn } from '../../../../lib/utils';
import { useEffect, useState } from 'react';
import { api } from '../../../../api/client';
import { PageHeader } from '../../../../components/layout/CommandShell';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import { pushToast } from '../../../../components/toast/toast';

interface DoctorApp {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  specialty: string;
  yearsExperience: number;
  bio: string;
  certificateFilename: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: string;
}

const apiBase = import.meta.env.VITE_API_URL ?? 'http://localhost:4000/api';

export const AdminDoctorApplications = () => {
  const [apps, setApps] = useState<DoctorApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

  const load = async () => {
    setLoading(true);
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`;
      const { data } = await api.get<DoctorApp[]>(`/doctor-applications${q}`);
      setApps(data);
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Load failed', body: e.response?.data?.error ?? 'Could not load applications' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [filter]);

  const approve = async (id: string) => {
    try {
      await api.post(`/doctor-applications/${id}/approve`);
      pushToast({ tone: 'success', title: 'Approved', body: 'Doctor record created.' });
      await load();
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Approve failed', body: e.response?.data?.error ?? 'Try again.' });
    }
  };

  const reject = async (id: string) => {
    const reason = window.prompt('Rejection reason (optional)') ?? '';
    try {
      await api.post(`/doctor-applications/${id}/reject`, { reason });
      pushToast({ tone: 'success', title: 'Rejected' });
      await load();
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Reject failed', body: e.response?.data?.error ?? 'Try again.' });
    }
  };

  const certUrl = (id: string) => {
    const token = JSON.parse(localStorage.getItem('at') ?? '""');
    return `${apiBase}/doctor-applications/${id}/certificate?auth=${encodeURIComponent(token)}`;
  };

  return (
    <>
      <PageHeader icon={IdentificationCard} title="Doctor review" subtitle="Check credentials before a doctor appears in the app's directory." />
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-sm w-fit" role="tablist">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)}
              className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', filter === f ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}>
              {f === 'pending' ? 'Waiting' : f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {!loading && !apps.length ? (
          <div className="rounded-[22px] border border-border bg-card px-6 py-12 text-center">
            <Tile icon={IdentificationCard} tone="teal" size="lg" round className="mx-auto" />
            <p className="mt-3 font-bold">Nothing here</p>
            <p className="text-sm text-muted-foreground mt-1">{filter === 'pending' ? 'No applications are waiting for review.' : 'No applications in this view.'}</p>
          </div>
        ) : null}

        <div className="grid xl:grid-cols-2 gap-5 stagger">
          {apps.map(a => (
            <article key={a.id} className="rounded-[22px] border border-border bg-card p-6 shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)] flex flex-col gap-4">
              <header className="flex items-center gap-4">
                <span className="w-12 h-12 rounded-full bg-[hsl(175_77%_21%)] text-white grid place-items-center font-bold">
                  {a.fullName.replace(/^Dr\.?\s*/i, '').split(' ').map(w => w[0]).slice(0, 2).join('')}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-[18px] font-extrabold tracking-[-0.02em] truncate">{a.fullName}</h3>
                  <p className="text-[14px] text-muted-foreground">{a.specialty} · <span className="num">{a.yearsExperience}</span> years</p>
                </div>
                <Chip tone={a.status === 'approved' ? 'teal' : a.status === 'rejected' ? 'sos' : 'amber'}>{a.status === 'pending' ? 'Waiting' : a.status[0].toUpperCase() + a.status.slice(1)}</Chip>
              </header>
              <p className="text-[14px] leading-relaxed text-foreground/80 line-clamp-3">{a.bio}</p>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><EnvelopeSimple size={16} weight="duotone" className="text-primary" />{a.email}</span>
                <span className="inline-flex items-center gap-1.5 num"><Phone size={16} weight="duotone" className="text-primary" />{a.phone}</span>
              </div>
              <a href={`${apiBase}/doctor-applications/${a.id}/certificate`} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 hover:border-primary/40 hover:bg-accent/40 transition-colors">
                <Tile icon={FilePdf} tone="sos" size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] font-semibold truncate">{a.certificateFilename}</span>
                  <span className="block text-[12px] text-muted-foreground">Specialty certificate · opens in a new window</span>
                </span>
                <ArrowSquareOut size={18} className="text-muted-foreground" />
              </a>
              {a.rejectionReason ? <p className="text-[13px] text-destructive">Rejected: {a.rejectionReason}</p> : null}
              {a.status === 'pending' ? (
                <div className="flex gap-2 pt-1 mt-auto">
                  <Button className="flex-1 rounded-xl h-10" onClick={() => approve(a.id)}><CheckCircle size={18} weight="bold" /> Approve</Button>
                  <Button className="flex-1 rounded-xl h-10" variant="outline" onClick={() => reject(a.id)}><XCircle size={18} weight="bold" /> Reject</Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </>
  );
};
