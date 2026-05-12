export const KPI = ({ label, value }: { label: string; value: any }) => (
  <div className="glass p-4">
    <div className="text-[10px] uppercase text-slate-400 tracking-wider">{label}</div>
    <div className="text-2xl font-semibold neon-text mt-1">{value}</div>
  </div>
);
