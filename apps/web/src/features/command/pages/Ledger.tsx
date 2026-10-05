import { CheckCircle, SealCheck, MapPin, PersonSimpleRun, Siren, UserCheck, Warning, XCircle, type Icon } from '@phosphor-icons/react';
import { Tile, type TileTone } from '../../../components/ui/tile';
import { useEffect, useState } from 'react';
import { api } from '../../../api/client';
import { Chip, Panel, Row } from '../../../components/ui/list';
import { Card, CardHeader, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/skeleton';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';

interface Block {
  _id: string;
  index: number;
  hash: string;
  prevHash: string;
  nonce: number;
  timestamp: string;
  payload?: { action?: string; entity?: string };
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
        title: data.valid ? 'Chain intact' : 'Chain corrupted',
        body: data.valid ? `${data.length} blocks verified` : `Broke at index ${data.brokenAt}`,
      });
    } finally { setLoading(false); }
  };

  return (
    <>
      <PageHeader icon={SealCheck}
        title="Blockchain ledger"
        subtitle="Immutable audit trail · SHA-256 chained"
      />
      <div className="p-6 max-w-5xl space-y-5">
        {/* Chain status: is the record intact, and how big is it. */}
        <section className="flex items-center gap-5 rounded-[22px] border border-border bg-card px-6 py-5 shadow-[0_10px_24px_-14px_hsl(176_30%_10%/0.25)]">
          <Tile icon={verify && !verify.valid ? Warning : SealCheck} tone={verify && !verify.valid ? 'sos' : verify ? 'deep' : 'teal'} size="lg" round />
          <div className="min-w-0 flex-1">
            <div className="text-[20px] font-extrabold tracking-[-0.02em]">
              {!verify ? 'Not checked this session' : verify.valid ? 'Chain intact' : `Chain broken at block #${verify.brokenAt}`}
            </div>
            <div className="text-[14px] text-muted-foreground">
              {verify?.valid ? `All ${verify.length} blocks re-hashed and linked.` : 'Every SOS, acceptance and closure is sealed into the block after it.'}
              {blocks.length ? <> Last block <span>{new Date(blocks[blocks.length - 1].timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>.</> : null}
            </div>
          </div>
          <Button loading={loading} onClick={runVerify} className="rounded-xl h-10 px-5">{verify ? 'Check again' : 'Verify chain'}</Button>
        </section>
        <Panel title={`${blocks.length} blocks`} aside={<span className="text-[13px] text-muted-foreground">Append-only · each block seals the one before</span>}>
          {loadingBlocks && Array.from({ length: 5 }).map((_, i) => <div key={i} className="px-5 py-4"><Skeleton className="h-10" /></div>)}
          {!loadingBlocks && blocks.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">No blocks yet. The first SOS writes the first one.</p>
          )}
          {blocks.map(b => {
            const [icon, tone] = ACTION_TILE[b.payload?.action ?? ''] ?? [SealCheck, 'slate'];
            return (
              <Row
                key={b._id}
                icon={icon}
                tone={tone}
                title={<span className="capitalize">{(b.payload?.action ?? '').replace('_', ' ')} · {b.payload?.entity}</span>}
                summary={<span className="code" title={`hash ${b.hash}\nprev ${b.prevHash}`}>{b.hash.slice(0, 24)}… ← {b.prevHash.slice(0, 12)}…</span>}
                right={<>
                  <span className="text-[13px] text-muted-foreground">{new Date(b.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <Chip><span className="num font-semibold text-foreground">#{b.index}</span></Chip>
                </>}
              />
            );
          })}
        </Panel>
      </div>
    </>
  );
};
