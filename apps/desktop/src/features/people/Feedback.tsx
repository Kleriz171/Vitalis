import { useCallback, useEffect, useState } from 'react';
import { ChatCircleText } from '@phosphor-icons/react';
import { useSelector } from 'react-redux';
import { api } from '../../api/client';
import { PageHeader } from '../../components/layout/CommandShell';
import { Chip, Panel } from '../../components/ui/list';
import { Button } from '../../components/ui/button';
import { pushToast } from '../../components/toast/toast';
import { roleLabel } from '../../lib/roles';
import { cn } from '../../lib/utils';
import type { RootState } from '../../store';

type Item = {
  id: string; category: string; message: string; status: string; priority: string; resolution?: string; createdAt: string;
  author: { id: string; name: string; role: string } | null; assignee: { id: string; name: string } | null;
  history: { at: string; by: string | null; change: string }[];
};
const STATUSES: [string, string][] = [['new', 'New'], ['in_review', 'In review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const CATEGORY: Record<string, string> = { app: 'The app', emergency: 'An emergency', responder: 'A responder', clinician: 'A clinician', hospital: 'A hospital', privacy: 'Privacy', other: 'Other' };
const SELECT = 'h-8 rounded-lg border border-border bg-card px-2 text-sm';

/** Administrators: feedback and complaints from users, from new to resolved. */
export const FeedbackPage = () => {
  const me = useSelector((s: RootState) => s.auth.user);
  const [status, setStatus] = useState('new');
  const [items, setItems] = useState<Item[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');

  const load = useCallback(() => api.get<Item[]>('/admin/feedback', { params: { status } }).then(r => setItems(r.data)).catch(() => setItems([])), [status]);
  useEffect(() => { setItems(null); void load(); }, [load]);

  const update = async (id: string, body: object) => {
    try {
      await api.patch(`/admin/feedback/${id}`, body);
      pushToast({ tone: 'success', title: 'Saved' });
      await load();
    } catch (err: any) {
      pushToast({ tone: 'error', title: 'Not saved', body: err?.response?.data?.error ?? 'Try again' });
    }
  };

  return (
    <>
      <PageHeader icon={ChatCircleText} title="Feedback" subtitle="What people tell us about the app, responders, clinicians and hospitals. Close each one with what was done." />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-1 rounded-xl bg-card border border-border p-1 shadow-sm w-fit" role="tablist">
          {STATUSES.map(([s, label]) => (
            <button key={s} role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
              className={cn('px-3.5 py-1.5 text-sm rounded-lg transition-colors', status === s ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground')}>{label}</button>
          ))}
        </div>
        <Panel>
          {!items && <p className="px-5 py-6 text-sm text-muted-foreground">Loading…</p>}
          {items?.length === 0 && <p className="px-5 py-10 text-center text-muted-foreground">Nothing here.</p>}
          {items?.map(f => (
            <div key={f.id} className="px-5 py-4 text-[14px]">
              <button className="w-full text-left" onClick={() => { setOpen(open === f.id ? null : f.id); setResolution(f.resolution ?? ''); }}>
                <div className="flex items-center gap-2">
                  <span className="font-semibold flex-1 truncate">{CATEGORY[f.category] ?? f.category} · {f.author?.name ?? 'Removed account'} <span className="font-normal text-muted-foreground">{f.author ? roleLabel(f.author.role) : ''}</span></span>
                  <Chip tone={f.priority === 'urgent' || f.priority === 'high' ? 'sos' : 'muted'}>{f.priority}</Chip>
                  <span className="num text-[13px] text-muted-foreground">{new Date(f.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                </div>
                <p className={cn('mt-1 text-muted-foreground', open !== f.id && 'truncate')}>{f.message}</p>
              </button>
              {open === f.id && (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={f.status} onChange={e => update(f.id, { status: e.target.value, ...(resolution.trim() ? { resolution: resolution.trim() } : {}) })} className={SELECT} aria-label="Status">
                      {STATUSES.map(([s, label]) => <option key={s} value={s}>{label}</option>)}
                    </select>
                    <select value={f.priority} onChange={e => update(f.id, { priority: e.target.value })} className={SELECT} aria-label="Priority">
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {f.assignee?.id !== me?.id
                      ? <Button size="sm" variant="outline" className="rounded-lg" onClick={() => update(f.id, { assignee: me?.id })}>Assign to me</Button>
                      : <span className="text-[13px] text-muted-foreground">Assigned to you</span>}
                  </div>
                  <textarea value={resolution} onChange={e => setResolution(e.target.value)} rows={2} maxLength={2000} placeholder="What was done (the person sees this)" aria-label="Resolution"
                    className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
                  <Button size="sm" className="rounded-lg" disabled={!resolution.trim()} onClick={() => update(f.id, { resolution: resolution.trim() })}>Save note</Button>
                  <ol className="text-[13px] text-muted-foreground space-y-0.5">
                    {f.history.map((h, i) => <li key={i}><span className="num">{new Date(h.at).toLocaleString('en-GB', { hourCycle: 'h23', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span> · {h.by ?? 'someone'}: {h.change}</li>)}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </Panel>
      </div>
    </>
  );
};
