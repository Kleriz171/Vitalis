import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { pushToast } from '../../components/toast/toast';

export const MedicineRadar = () => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.get('/medicine/search', { params: { q } });
      setResults(data);
      if (data.length === 0) pushToast({ tone: 'info', title: 'No results', body: 'Try a different query' });
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Search failed', body: e.response?.data?.error });
    } finally { setLoading(false); }
  };

  const reserve = async (id: string) => {
    try {
      await api.post(`/medicine/${id}/reserve`);
      pushToast({ tone: 'success', title: 'Reserved', body: 'Pharmacy will hold for 30 min' });
    } catch (e: any) {
      pushToast({ tone: 'error', title: 'Reserve failed', body: e.response?.data?.error });
    }
  };

  return (
    <div className="space-y-4">
      <Card tone="strong" className="p-5">
        <h2 className="font-semibold mb-1">Medicine Radar</h2>
        <p className="text-xs text-slate-400 mb-4">Locate rare medicines at nearby pharmacies in real time.</p>
        <form onSubmit={search} className="flex gap-2">
          <input
            className="flex-1 bg-ink-700/70 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-neon-cyan/60"
            placeholder="e.g. epinephrine"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
          <Button type="submit" loading={loading}>Search</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {results.length === 0 && !loading && (
          <p className="text-xs text-slate-500 text-center py-8">Search above to see live pharmacy stock.</p>
        )}
        {results.map(r => (
          <motion.div
            key={r._id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm flex items-center gap-2">
                  {r.medicine?.name}
                  {r.rare && <Badge tone="violet">Rare</Badge>}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {r.pharmacy?.name ?? 'Pharmacy'} · stock {r.stock}
                </div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => reserve(r._id)} disabled={r.stock < 1}>
                Reserve
              </Button>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
