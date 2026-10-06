import { CheckCircle, SealCheck, MapPin, PersonSimpleRun, Siren, UserCheck, Warning, XCircle, type Icon } from '@phosphor-icons/react';
import { Tile, type TileTone } from '../../../components/ui/tile';
import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Chip, Panel, Row } from '../../../components/ui/list';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { ExportPdfButton, PageHeader } from '../../../components/layout/CommandShell';
import { Notes, Report, ReportSection, Table } from '../../../components/print/Report';
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

      {/* Export PDF: the log as a document, checked just before printing. */}
      <Report title="Call log" details={[
        ['Entries', blocks.length ? `#${blocks[0].index} to #${blocks[blocks.length - 1].index} (${blocks.length})` : 'None'],
        ['Covers', blocks.length ? `${when(blocks[0].timestamp)} to ${when(blocks[blocks.length - 1].timestamp)}` : '—'],
      ]}>
        <ReportSection n={1} title="Integrity check">
          <div className={verify && !verify.valid ? 'rounded-md border border-[#D92D2D] bg-[#FDECEC] px-3 py-2.5' : 'rounded-md border border-[#D9D6CE] bg-[#F7F5F0] px-3 py-2.5'}>
            <div className={verify && !verify.valid ? 'text-[11pt] font-extrabold text-[#B42318]' : 'text-[11pt] font-extrabold text-[#0C5D57]'}>
              {!verify ? 'Not checked' : verify.valid ? `Intact: ${verify.length === 1 ? 'the 1 entry was' : `all ${verify.length} entries were`} checked, nothing was changed` : `Changed: the log was altered at entry #${verify.brokenAt}`}
            </div>
            <p className="mt-1 text-[9pt] text-[#55635F]">Checked when this report was exported. Each entry carries a seal made from its own contents and the seal of the entry before it, so changing any entry breaks every seal after it.</p>
          </div>
        </ReportSection>
        <ReportSection n={2} title="Entries" note="Oldest first. Times are local (Tirana)." keep={false}>
          <Table head={['No.', 'Time', 'Event', 'Concerns', 'Seal']} right={[0]} empty="No entries yet."
            rows={blocks.map(b => [b.index, when(b.timestamp, true), describe(b).event, describe(b).subject, <span key="s" className="font-mono text-[8pt] text-[#55635F]">{b.hash.slice(0, 16)}</span>])} />
        </ReportSection>
        <Notes>
          <p>The seal shown is the first 16 characters of each entry&apos;s SHA-256 seal. The full seals are kept in Vitalis and can be re-checked at any time from Reports → Call log.</p>
        </Notes>
      </Report>
    </>
  );
};
