import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../../api/client';
import { Card, CardHeader, CardBody } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { PageHeader } from '../../../components/layout/CommandShell';
import { pushToast } from '../../../components/toast/toast';

export const Ledger = () => {
  const [blocks, setBlocks] = useState<any[]>([]);
  const [verify, setVerify] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = () => api.get('/blockchain').then(r => setBlocks(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const runVerify = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/blockchain/verify');
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
        title="Blockchain Ledger"
        subtitle="Immutable audit trail · SHA-256 chained"
        actions={
          <div className="flex items-center gap-3">
            {verify && (
              <Badge tone={verify.valid ? 'emerald' : 'pink'}>
                {verify.valid ? `✓ ${verify.length} blocks` : `✗ broken @ ${verify.brokenAt}`}
              </Badge>
            )}
            <Button loading={loading} onClick={runVerify}>Verify chain</Button>
          </div>
        }
      />
      <div className="p-6 max-w-4xl">
        <Card tone="strong" className="overflow-hidden">
          <CardHeader title={`${blocks.length} blocks`} subtitle="Append-only · difficulty 2" />
          <CardBody className="space-y-2">
            {blocks.length === 0 && (
              <p className="text-xs text-slate-500 text-center py-12">No blocks yet — trigger an emergency to mint the first one.</p>
            )}
            {blocks.map((b, i) => (
              <motion.div
                key={b._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-neon-cyan/30 transition"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl font-mono text-neon-cyan/60">#{b.index}</div>
                    <div>
                      <div className="text-xs text-slate-300 capitalize">{b.payload?.action} · {b.payload?.entity}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{new Date(b.timestamp).toLocaleString()}</div>
                    </div>
                  </div>
                  <Badge tone="violet">nonce {b.nonce}</Badge>
                </div>
                <div className="font-mono text-[10px] text-slate-500 break-all">
                  <span className="text-slate-600">hash:</span> {b.hash}
                </div>
                <div className="font-mono text-[10px] text-slate-600 break-all mt-1">
                  <span className="text-slate-700">prev:</span> {b.prevHash}
                </div>
              </motion.div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
};
