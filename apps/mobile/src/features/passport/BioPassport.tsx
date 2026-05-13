import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../../api/client';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';

export const BioPassport = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['biopassport'],
    queryFn: async () => (await api.get('/biopassport/me')).data,
  });

  if (isLoading) {
    return (
      <Card tone="strong" className="p-5">
        <div className="h-40 animate-pulse bg-white/5 rounded-xl" />
      </Card>
    );
  }
  if (error || !data) return <Card className="p-5 text-sm text-neon-pink">Failed to load.</Card>;

  const p = data.profile;
  return (
    <div className="space-y-4">
      <Card tone="strong" className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Bio Passport</h2>
            <p className="text-xs text-slate-400">Tap to scan in an emergency</p>
          </div>
          <Badge tone="cyan">Live</Badge>
        </div>

        <motion.div
          whileHover={{ y: -2 }}
          className="bg-white rounded-xl p-3 mx-auto w-44"
        >
          {data.qr && <img src={data.qr} alt="bio passport QR" className="w-full" />}
        </motion.div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Name" value={p?.name} />
          <Field label="Blood" value={p?.bloodType} mono />
          <Field label="Phone" value={p?.phone} />
          <Field label="Allergies" value={p?.allergies?.join(', ') || 'None'} span />
        </dl>
      </Card>

      <Card className="p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Emergency contact</div>
        <div className="text-sm">{p?.emergencyContact?.name ?? '—'}</div>
        <div className="text-xs text-slate-400 font-mono">{p?.emergencyContact?.phone ?? '—'}</div>
      </Card>
    </div>
  );
};

const Field = ({ label, value, mono, span }: { label: string; value?: any; mono?: boolean; span?: boolean }) => (
  <div className={span ? 'col-span-2' : ''}>
    <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    <div className={`${mono ? 'font-mono' : ''} text-slate-200`}>{value ?? '—'}</div>
  </div>
);
