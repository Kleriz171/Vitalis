import { CheckCircle, SealCheck, MapPin, PersonSimpleRun, Siren, UserCheck, Warning, XCircle, type Icon } from '@phosphor-icons/react';
import { Tile, type TileTone } from '../../../components/ui/tile';
import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Chip, Panel, Row } from '../../../components/ui/list';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ExportPdfButton, PageHeader } from '../../../components/layout/CommandShell';
import { Empty, Note, Report, REPORT_COLORS as C, Section } from '../../../components/print/Report';
import { shortId } from '../../../lib/format';
import { pushToast } from '../../../components/toast/toast';

interface Block {
  _id: string;
  index: number;
  hash: string;
  prevHash: string;
  nonce: number;
  timestamp: string;
  payload?: { action?: string; entity?: string; entityId?: string };
}

interface VerifyResult {
  valid: boolean;
  length: number;
  brokenAt?: number;
}

// What each audit entry records, as the phone app would show it.
const ACTION_TILE: Record<string, [Icon, TileTone]> = {
  created: [Siren, 'sos'],
  assigned: [UserCheck, 'teal'],
  en_route: [PersonSimpleRun, 'mint'],
  on_scene: [MapPin, 'teal'],
  resolved: [CheckCircle, 'teal'],
  cancelled: [XCircle, 'slate'],
};

// Plain names for what each entry records.
const EVENT: Record<string, string> = {
  created: 'SOS received', assigned: 'Responder accepted', aed_runner_assigned: 'Defibrillator runner assigned',
  en_route: 'Responder on the way', on_scene: 'Responder arrived', resolved: 'Call closed', cancelled: 'Call cancelled',
  dispatched: 'Drone sent', delivered: 'Drone delivered', aborted: 'Drone flight stopped',
  aed_to_aed: 'Runner heading to the defibrillator', aed_has_aed: 'Runner has the defibrillator', aed_delivered: 'Defibrillator delivered',
  released: 'Responder released, call sent to others',
  checkin_missed: 'Safety check-in missed', checkin_duress: 'Safety check-in: duress PIN used', checkin_pin_attempts: 'Safety check-in: wrong PIN too often',
  takeoff: 'Drone took off', land: 'Drone landed', emergency: 'Drone emergency stop', launched: 'Drone launched', in_flight: 'Drone in flight',
};
const sentence = (s: string) => { const t = s.replace(/_/g, ' '); return t.charAt(0).toUpperCase() + t.slice(1); };
const describe = (b: Block) => {
  const action = b.payload?.action ?? '';
  const id = b.payload?.entityId;
  const event = EVENT[action]
    ?? (action.startsWith('aed_') ? `Defibrillator ${action.slice(4).replace(/_/g, ' ')}`
      : action.startsWith('checkin_') ? `Safety check-in: ${action.slice(8).replace(/_/g, ' ')}`
        : sentence(action || 'entry'));
  const subject = b.payload?.entity === 'emergency' ? `Call #${shortId(id ?? '')}`
    : b.payload?.entity === 'drone_mission' ? `Drone flight #${shortId(id ?? '')}`
      : b.payload?.entity === 'drone' ? `Drone ${id ?? ''}` : sentence(b.payload?.entity ?? '');
  return { event, subject };
};
const when = (iso: string, seconds = false) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: seconds ? '2-digit' : undefined });

export const Ledger = () => {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [verify, setVerify] = useState<VerifyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingBlocks, setLoadingBlocks] = useState(true);

  const load = () =>
    api.get('/blockchain').then(r => setBlocks(r.data)).catch(() => {}).finally(() => setLoadingBlocks(false));
  useEffect(() => { load(); }, []);

  const runVerify = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<VerifyResult>('/blockchain/verify');
      setVerify(data);
      pushToast({
        tone: data.valid ? 'success' : 'error',
        title: data.valid ? 'Log intact' : 'Log was changed',
        body: data.valid ? `${data.length} ${data.length === 1 ? 'entry' : 'entries'} checked` : `Changed at entry #${data.brokenAt}`,
      });
    } finally { setLoading(false); }
  };

  return (
    <>
      <div className="print:hidden">
      <PageHeader icon={SealCheck}
        title="Call log"
        subtitle="Every step of every call, sealed so nobody can change it afterwards."
        actions={<ExportPdfButton name="call log" prepare={runVerify} />}
      />
      <div className="p-6 max-w-5xl space-y-5">
        {/* Chain status: is the record intact, and how big is it. */}
        <section className="flex items-center gap-5 rounded-[22px] border border-border bg-card px-6 py-5 shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
          <Tile icon={verify && !verify.valid ? Warning : SealCheck} tone={verify && !verify.valid ? 'sos' : verify ? 'deep' : 'teal'} size="lg" round />
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-extrabold tracking-[-0.02em]">
              {!verify ? 'Not checked yet' : verify.valid ? 'Log intact' : `Log was changed at entry #${verify.brokenAt}`}
            </div>
            <div className="text-[14px] text-muted-foreground">
              {verify?.valid ? `${verify.length === 1 ? 'The 1 entry was' : `All ${verify.length} entries were`} checked, nothing was changed.` : 'Each SOS, acceptance and closure is sealed to the entry before it, so any edit shows up here.'}
              {blocks.length ? <> Last entry <span>{new Date(blocks[blocks.length - 1].timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>.</> : null}
            </div>
          </div>
          <Button loading={loading} onClick={runVerify} className="rounded-xl h-10 px-5">{verify ? 'Check again' : 'Check the log'}</Button>
        </section>
        <Panel title={`${blocks.length} ${blocks.length === 1 ? 'entry' : 'entries'}`} aside={<span className="text-[13px] text-muted-foreground">Newest last · entries can be added, never edited</span>}>
          {loadingBlocks && Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10" /></div>)}
          {!loadingBlocks && blocks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">Nothing yet. The first SOS writes the first entry.</p>
          )}
          {blocks.map(b => {
            const [icon, tone] = ACTION_TILE[b.payload?.action ?? ''] ?? [SealCheck, 'slate'];
            return (
              <Row
                key={b._id}
                icon={icon}
                tone={tone}
                title={`${describe(b).event} · ${describe(b).subject}`}
                summary={<span title={`Seal ${b.hash}\nPrevious ${b.prevHash}`}>Seal <span className="code">{b.hash.slice(0, 12)}</span></span>}
                right={<>
                  <span className="text-[13px] text-muted-foreground">{new Date(b.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <Chip><span className="num font-semibold text-foreground">#{b.index}</span></Chip>
                </>}
              />
            );
          })}
        </Panel>
      </div>
      </div>

      {/* Export PDF: the log as a designed document, checked just before printing. */}
      <CallLogReport blocks={blocks} verify={verify} />
    </>
  );
};

/** Colour of an entry's dot: red for a new SOS, grey for cancelled, green for closed, teal otherwise. */
const dot = (action?: string) => action === 'created' ? C.sos : action === 'cancelled' ? '#9BB5B0' : action === 'resolved' ? C.green : C.teal;

const CallLogReport = ({ blocks, verify }: { blocks: Block[]; verify: VerifyResult | null }) => {
  const broken = verify && !verify.valid;
  const date = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleString('en-GB', o);
  const days = blocks.reduce<{ key: string; items: Block[] }[]>((g, b) => {
    const key = date(b.timestamp, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    if (g[g.length - 1]?.key === key) g[g.length - 1].items.push(b); else g.push({ key, items: [b] });
    return g;
  }, []);
  const n = blocks.length;
  const period = n
    ? `${date(blocks[0].timestamp, { day: 'numeric', month: 'short', year: 'numeric' })} – ${date(blocks[n - 1].timestamp, { day: 'numeric', month: 'short', year: 'numeric' })} · ${n} ${n === 1 ? 'entry' : 'entries'}`
    : 'No entries yet';
  const links = Math.min(n, 18);
  return (
    <Report title="Call log" period={period} meta={n ? [['Entries', `#${blocks[0].index} – #${blocks[n - 1].index}`]] : []}>
      <Section n={1} title="Integrity" lead="Checked at the moment of export.">
        <div className="flex items-center gap-5 rounded-[18px] px-5 py-4"
          style={broken ? { background: '#FDECEC', border: `1px solid ${C.sos}` } : { background: C.paper, border: `1px solid ${C.line}` }}>
          <span className="w-12 h-12 shrink-0 rounded-full grid place-items-center text-white" style={{ background: broken ? C.sos : C.green }}>
            {broken ? <Warning size={24} weight="bold" /> : <SealCheck size={24} weight="bold" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[16pt] font-extrabold tracking-[-0.02em]" style={{ color: broken ? '#B42318' : C.green }}>
              {!verify ? 'Not checked' : broken ? `Changed at entry #${verify.brokenAt}` : 'Intact'}
            </div>
            <div className="text-[9pt]" style={{ color: C.muted }}>
              {!verify ? 'The check could not run.' : broken ? 'An entry was altered after it was written. Every entry after it no longer matches.'
                : `${verify.length === 1 ? 'The 1 entry in the log matches its seal' : `All ${verify.length} entries in the log match their seals`}. Nothing was changed.${verify.length > n ? ` This report lists the newest ${n}.` : ''}`}
            </div>
          </div>
          {/* The chain: each entry sealed to the one before. */}
          {links > 0 && (
            <svg viewBox={`0 0 ${links * 16 + 4} 20`} width={Math.min(170, links * 16 + 4)} aria-hidden>
              {Array.from({ length: links }).map((_, i) => {
                const bad = broken && blocks[n - links + i]?.index >= (verify?.brokenAt ?? Infinity);
                return (
                  <g key={i}>
                    {i > 0 && <line x1={i * 16 - 6} x2={i * 16 + 4} y1="10" y2="10" stroke={bad ? C.sos : C.mint} strokeWidth="2" />}
                    <circle cx={i * 16 + 9} cy="10" r="5" fill={bad ? C.sos : C.teal} />
                  </g>
                );
              })}
            </svg>
          )}
        </div>
      </Section>

      <Section n={2} title="Timeline" lead="Every step of every call, oldest first. Times are local (Tirana)." keep={false}>
        {n === 0 ? <Empty>No entries yet. The first SOS writes the first one.</Empty> : (
          <div className="space-y-5">
            {days.map(d => (
              <div key={d.key}>
                <div className="break-after-avoid flex items-baseline justify-between border-b pb-1.5 mb-1" style={{ borderColor: C.ink }}>
                  <span className="text-[10pt] font-bold" style={{ color: C.ink }}>{d.key}</span>
                  <span className="text-[8pt]" style={{ color: C.muted }}>{d.items.length} {d.items.length === 1 ? 'entry' : 'entries'}</span>
                </div>
                {d.items.map(b => {
                  const { event, subject } = describe(b);
                  return (
                    <div key={b._id} className="break-inside-avoid grid grid-cols-[62px_14px_1fr_auto_118px_34px] items-center gap-2 py-[5px] border-b text-[9pt]" style={{ borderColor: C.line }}>
                      <span className="tabular-nums font-semibold" style={{ color: C.ink }}>{date(b.timestamp, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      <span className="w-2.5 h-2.5 rounded-full" style={{ background: dot(b.payload?.action) }} />
                      <span className="font-semibold truncate" style={{ color: C.ink }}>{event}</span>
                      <span className="rounded-full px-2 py-[1px] text-[8pt] font-semibold" style={{ background: '#E3F4F1', color: C.green }}>{subject}</span>
                      <span className="font-mono text-[7.5pt] text-right" style={{ color: C.muted }}>{b.hash.slice(0, 16)}</span>
                      <span className="text-right tabular-nums text-[8pt]" style={{ color: C.muted }}>#{b.index}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Note title="About the seals">
        Each entry is sealed with a SHA-256 code made from its own contents and the seal of the entry before it, so changing any entry
        breaks every seal after it. The first 16 characters are shown; the full seals stay in Vitalis and can be re-checked any time
        from Reports → Call log.
      </Note>
    </Report>
  );
};
