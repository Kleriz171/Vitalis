import { useEffect, useState } from 'react';
import { Plus, Sliders, Trash } from '@phosphor-icons/react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/layout/CommandShell';
import { Panel } from '../../components/ui/list';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { pushToast } from '../../components/toast/toast';

type Hours = { day: number; start: string; end: string };
type ConsultationType = { id?: string; name: string; minutes: number; price: number; online: boolean; active: boolean };
interface Clinic { specialty: string; biography?: string; workingHours: Hours[]; daysOff: string[]; consultationTypes: ConsultationType[] }

// Monday first, as clinics plan their week.
const DAYS: [number, string][] = [[1, 'Monday'], [2, 'Tuesday'], [3, 'Wednesday'], [4, 'Thursday'], [5, 'Friday'], [6, 'Saturday'], [0, 'Sunday']];
const MINUTES = [15, 30, 45, 60, 90, 120];
const FIELD = 'h-9 rounded-md border border-input bg-transparent px-2 text-sm';

/** Clinician settings: weekly hours, days off, what they offer and for how much. */
export const ClinicSettings = () => {
  const [c, setC] = useState<Clinic | null>(null);
  const [dayOff, setDayOff] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/clinic/me').then(r => setC(r.data ?? {
      specialty: '', workingHours: [1, 2, 3, 4, 5].map(day => ({ day, start: '09:00', end: '17:00' })), daysOff: [],
      consultationTypes: [{ name: 'Consultation', minutes: 30, price: 3000, online: false, active: true }],
    })).catch(() => pushToast({ tone: 'error', title: 'Could not load your settings' }));
  }, []);

  if (!c) return <PageHeader icon={Sliders} title="Clinic settings" subtitle="Loading…" />;
  const set = (patch: Partial<Clinic>) => setC({ ...c, ...patch });
  const setType = (i: number, patch: Partial<ConsultationType>) => set({ consultationTypes: c.consultationTypes.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const setHours = (i: number, patch: Partial<Hours>) => set({ workingHours: c.workingHours.map((h, j) => (j === i ? { ...h, ...patch } : h)) });

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/clinic/settings', {
        ...(c.specialty.trim() ? { specialty: c.specialty.trim() } : {}),
        biography: c.biography ?? '',
        workingHours: c.workingHours,
        daysOff: c.daysOff,
        consultationTypes: c.consultationTypes.map(t => ({ ...t, price: Math.round(Number(t.price) || 0) })),
      });
      setC(data);
      pushToast({ tone: 'success', title: 'Saved', body: 'Patients see the new hours and fees now. Existing bookings keep their price.' });
    } catch (err: any) {
      const issue = err?.response?.data?.issues?.[0];
      pushToast({ tone: 'error', title: 'Not saved', body: issue ? `${issue.path}: ${issue.message}` : err?.response?.data?.error ?? 'Try again' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader icon={Sliders} title="Clinic settings" subtitle="When patients can book you, what you offer and what it costs."
        actions={<Button onClick={save} disabled={saving} className="rounded-xl bg-white text-primary hover:bg-white/90 h-10 px-4 font-semibold">Save</Button>} />
      <div className="p-6 max-w-4xl space-y-5">
        <Panel title="Consultations and fees" aside={<span className="text-[13px] text-muted-foreground">Prices in lekë, paid at the consultation</span>}>
          <div className="p-4 space-y-2">
            {c.consultationTypes.map((t, i) => (
              <div key={t.id ?? `new-${i}`} className="grid grid-cols-[1fr_110px_120px_auto_auto_auto] items-center gap-2">
                <Input value={t.name} onChange={e => setType(i, { name: e.target.value })} aria-label="Name" maxLength={60} />
                <select value={t.minutes} onChange={e => setType(i, { minutes: Number(e.target.value) })} className={FIELD} aria-label="Length">
                  {MINUTES.map(m => <option key={m} value={m}>{m} min</option>)}
                </select>
                <Input type="number" min={0} step={100} value={t.price} onChange={e => setType(i, { price: Number(e.target.value) })} aria-label="Price in lekë" />
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={t.online} onChange={e => setType(i, { online: e.target.checked })} /> Online</label>
                <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={t.active} onChange={e => setType(i, { active: e.target.checked })} /> Offered</label>
                <Button size="icon" variant="ghost" aria-label="Remove" onClick={() => set({ consultationTypes: c.consultationTypes.filter((_, j) => j !== i) })}><Trash size={16} /></Button>
              </div>
            ))}
            <Button size="sm" variant="outline" className="rounded-lg" onClick={() => set({ consultationTypes: [...c.consultationTypes, { name: '', minutes: 30, price: 0, online: false, active: true }] })}><Plus size={16} /> Add a type</Button>
          </div>
        </Panel>

        <Panel title="Weekly hours" aside={<span className="text-[13px] text-muted-foreground">Tirana time</span>}>
          <div className="p-4 space-y-3">
            {DAYS.map(([day, label]) => {
              const ranges = c.workingHours.map((h, i) => [h, i] as const).filter(([h]) => h.day === day);
              return (
                <div key={day} className="grid grid-cols-[120px_1fr] items-start gap-3">
                  <div className="pt-2 text-sm font-semibold">{label}</div>
                  <div className="flex flex-wrap items-center gap-2">
                    {ranges.length === 0 && <span className="text-sm text-muted-foreground pt-2">Not working</span>}
                    {ranges.map(([h, i]) => (
                      <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-border px-2 py-1">
                        <input type="time" step={900} value={h.start} onChange={e => setHours(i, { start: e.target.value })} className="text-sm bg-transparent" aria-label={`${label} from`} />
                        –
                        <input type="time" step={900} value={h.end} onChange={e => setHours(i, { end: e.target.value })} className="text-sm bg-transparent" aria-label={`${label} until`} />
                        <button onClick={() => set({ workingHours: c.workingHours.filter((_, j) => j !== i) })} aria-label="Remove hours" className="text-muted-foreground hover:text-foreground"><Trash size={14} /></button>
                      </span>
                    ))}
                    <Button size="sm" variant="ghost" className="rounded-lg" onClick={() => set({ workingHours: [...c.workingHours, { day, start: '09:00', end: '13:00' }] })}><Plus size={14} /> Hours</Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="Days off">
          <div className="p-4 space-y-3">
            <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); if (dayOff) { set({ daysOff: [...new Set([...c.daysOff, dayOff])].sort() }); setDayOff(''); } }}>
              <input type="date" value={dayOff} onChange={e => setDayOff(e.target.value)} className={FIELD} aria-label="Day off" />
              <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={!dayOff}>Add</Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {c.daysOff.length === 0 && <span className="text-sm text-muted-foreground">None. Bookings already made on a new day off stay: cancel or move them in the calendar.</span>}
              {c.daysOff.map(d => (
                <span key={d} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-sm num">
                  {new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  <button onClick={() => set({ daysOff: c.daysOff.filter(x => x !== d) })} aria-label="Remove day off" className="text-muted-foreground hover:text-foreground"><Trash size={14} /></button>
                </span>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Profile">
          <div className="p-4 grid gap-3">
            <div className="space-y-1.5"><Label htmlFor="spec">Specialty</Label><Input id="spec" value={c.specialty} onChange={e => set({ specialty: e.target.value })} maxLength={80} /></div>
            <div className="space-y-1.5"><Label htmlFor="bio">About you (shown to patients)</Label>
              <textarea id="bio" value={c.biography ?? ''} onChange={e => set({ biography: e.target.value })} maxLength={1000} rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" />
            </div>
          </div>
        </Panel>
      </div>
    </>
  );
};
