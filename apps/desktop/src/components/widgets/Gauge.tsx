/** A ring gauge: one percentage, a label under it. Empty ring and a dash when there is no data. */
export const Gauge = ({ value, label, size = 96 }: { value: number | null; label: string; size?: number }) => {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  // Under target reads amber, at or above 80 % teal.
  const color = value == null ? 'transparent' : pct >= 80 ? 'hsl(var(--teal))' : pct >= 50 ? 'hsl(var(--warn))' : 'hsl(var(--sos))';
  return (
    <div className="relative grid place-items-center rounded-full bg-card shadow-[0_8px_20px_-8px_hsl(176_30%_10%/0.25),inset_0_0_0_1px_hsl(var(--border))]" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${value == null ? 'no data' : `${pct}%`}`}>
      <svg width={size} height={size} className="absolute inset-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r - 4} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r - 4} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={2 * Math.PI * (r - 4)} strokeDashoffset={2 * Math.PI * (r - 4) * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="relative text-center leading-none">
        <div className="num text-[19px] font-extrabold tracking-[-0.02em]">{value == null ? '—' : `${pct}%`}</div>
        <div className="mt-1 text-[10px] font-medium text-muted-foreground max-w-[60px] leading-tight">{label}</div>
      </div>
    </div>
  );
};
