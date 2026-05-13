import { useEffect, useState } from 'react';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { api } from '../../../api/client';
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
      <PageHeader
        title="Blockchain ledger"
        subtitle="Immutable audit trail · SHA-256 chained"
        actions={
          <div className="flex items-center gap-3">
            {verify && (
              <Badge variant={verify.valid ? 'secondary' : 'destructive'} className="gap-1.5">
                {verify.valid ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                {verify.valid ? `${verify.length} blocks` : `Broken @ ${verify.brokenAt}`}
              </Badge>
            )}
            <Button loading={loading} onClick={runVerify}>Verify chain</Button>
          </div>
        }
      />
      <div className="p-6 max-w-4xl">
        <Card className="overflow-hidden gap-0 py-0">
          <CardHeader className="px-5 py-4 border-b">
            <div className="font-semibold">{blocks.length} blocks</div>
            <div className="text-xs text-muted-foreground">Append-only · difficulty 2</div>
          </CardHeader>
          <CardContent className="space-y-2 p-3">
            {loadingBlocks && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            ))}
            {!loadingBlocks && blocks.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-12">
                No blocks yet — trigger an emergency to mint the first one.
              </p>
            )}
            {blocks.map(b => (
              <div
                key={b._id}
                className="p-4 rounded-xl bg-muted/30 border border-border hover:border-primary/40 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono text-primary/70">#{b.index}</div>
                    <div>
                      <div className="text-xs capitalize font-medium">
                        {b.payload?.action} · {b.payload?.entity}
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {new Date(b.timestamp).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">nonce {b.nonce}</Badge>
                </div>
                <div className="font-mono text-[10px] text-muted-foreground break-all">
                  <span className="opacity-60">hash:</span> {b.hash}
                </div>
                <div className="font-mono text-[10px] text-muted-foreground/70 break-all mt-1">
                  <span className="opacity-60">prev:</span> {b.prevHash}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
};
