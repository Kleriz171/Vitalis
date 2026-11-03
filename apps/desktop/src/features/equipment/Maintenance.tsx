import { useCallback, useEffect, useState } from 'react';
import { Wrench } from '@phosphor-icons/react';
import { api } from '../../api/client';
import { Chip, Panel } from '../../components/ui/list';
import { Button } from '../../components/ui/button';
import { pushToast } from '../../components/toast/toast';

type Due = {
  id: string; name: string; placement?: string; reasons: string[]; battery: number | null; padsExpireAt?: string; lastInspectionAt: string | null;
  task: { note: string; assignee: { id: string; name: string } | null; dueAt?: string } | null;
};
const REASON: Record<string, string> = {
  pads_expired: 'Pads expired', pads_expiring: 'Pads expire within 30 days', battery_low: 'Battery under 25%',
  problem: 'Problem reported', inspection_overdue: 'No inspection for 6 months',
};
const day = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'never');

/** Operators: defibrillators that need someone, and the one open job per device. */
export const Maintenance = () => {
  const [due, setDue] = useState<Due[] | null>(null);
  const [operators, setOperators] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.get('/aeds/maintenance').then(r => { setDue(r.data.due); setOperators(r.data.operators); }).catch(() => setDue([])), []);
  useEffect(() => { void load(); }, [load]);

  const act = async (request: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try { await request(); pushToast({ tone: 'success', title: done }); await load(); }
    catch (err: any) { pushToast({ tone: 'error', title: 'Not saved', body: err?.response?.data?.error ?? 'Try again' }); }
    finally { setBusy(false); }
  };

  if (!due?.length) return null;
  return (
    <Panel title="Needs maintenance" aside={<span className="num text-[13px] text-muted-foreground">{due.length}</span>}>
      {due.map(d => (
        <div key={d.id} className="px-5 py-3 text-[14px] space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Wrench size={18} weight="duotone" className="text-primary" />
            <span className="font-semibold">{d.name}</span>
            {d.reasons.map(r => <Chip key={r} tone={r === 'pads_expired' || r === 'problem' ? 'sos' : 'amber'}>{REASON[r] ?? r}</Chip>)}
            <span className="ml-auto text-[13px] text-muted-foreground">Last inspection {day(d.lastInspectionAt)}</span>
          </div>
          {d.task ? (
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              <span className="flex-1">{d.task.note}{d.task.assignee ? ` · ${d.task.assignee.name}` : ''}{d.task.dueAt ? ` · by ${day(d.task.dueAt)}` : ''}</span>
              <Button size="sm" variant="outline" className="rounded-lg" disabled={busy} onClick={() => act(() => api.post(`/aeds/${d.id}/task/done`, {}), 'Task closed')}>Done</Button>
            </div>
          ) : (
            <form className="flex flex-wrap items-center gap-2" onSubmit={e => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const dueAt = String(f.get('dueAt') || '');
              void act(() => api.post(`/aeds/${d.id}/task`, { note: String(f.get('note')), ...(f.get('assigneeId') ? { assigneeId: String(f.get('assigneeId')) } : {}), ...(dueAt ? { dueAt: new Date(`${dueAt}T17:00:00`).toISOString() } : {}) }), 'Task assigned');
            }}>
              <input name="note" required minLength={3} maxLength={300} placeholder="What needs doing" aria-label="Task" className="h-8 flex-1 min-w-48 rounded-lg border border-border bg-card px-3 text-sm" />
              <select name="assigneeId" className="h-8 rounded-lg border border-border bg-card px-2 text-sm" aria-label="Assign to">
                <option value="">Unassigned</option>
                {operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input name="dueAt" type="date" className="h-8 rounded-lg border border-border bg-card px-2 text-sm" aria-label="Due" />
              <Button type="submit" size="sm" className="rounded-lg" disabled={busy}>Assign</Button>
            </form>
          )}
        </div>
      ))}
    </Panel>
  );
};
