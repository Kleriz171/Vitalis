import { useEffect, useState } from 'react';
import { api } from '../../../../api/client';
import { PageHeader } from '../../../../components/layout/CommandShell';
import { Button } from '../../../../components/ui/button';
import { Card, CardContent } from '../../../../components/ui/card';
import { pushToast } from '../../../../components/toast/toast';
import { FileText } from 'lucide-react';

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
      <PageHeader title="Doctor applications" subtitle="Review submitted credentials before doctors appear in the directory." />
      <div className="p-8 space-y-6">
        <div className="flex gap-2">
          {(['pending', 'approved', 'rejected', 'all'] as const).map(s => (
            <Button key={s} variant={filter === s ? 'default' : 'outline'} size="sm" onClick={() => setFilter(s)}>
              {s[0].toUpperCase() + s.slice(1)}
            </Button>
          ))}
        </div>

        {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}

        {apps.map(a => (
          <Card key={a.id}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">{a.fullName} <span className="text-xs uppercase tracking-wide text-muted-foreground ml-2">{a.status}</span></h3>
                  <p className="text-sm text-muted-foreground">{a.specialty} · {a.yearsExperience} years</p>
                  <p className="text-xs text-muted-foreground mt-1">{a.email} · {a.phone}</p>
                </div>
                <a
                  href={`${apiBase}/doctor-applications/${a.id}/certificate`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  <FileText size={14} /> {a.certificateFilename}
                </a>
              </div>
              <p className="text-sm whitespace-pre-wrap border-l-2 border-border pl-3">{a.bio}</p>
              {a.rejectionReason ? <p className="text-xs text-destructive">Rejected: {a.rejectionReason}</p> : null}
              {a.status === 'pending' ? (
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => approve(a.id)}>Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => reject(a.id)}>Reject</Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}

        {!loading && !apps.length ? <p className="text-sm text-muted-foreground">No applications in this view.</p> : null}
      </div>
    </>
  );
};
