/** Decorative radar: range rings, a rotating sweep and a few contacts. Pure SVG + CSS. */
export const Radar = ({ className = 'w-[360px]' }: { className?: string }) => (
  <div className={`relative shrink-0 aspect-square ${className}`} aria-hidden>
    <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
      <defs>
        <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(172 78% 47% / 0.10)" />
          <stop offset="100%" stopColor="hsl(172 78% 47% / 0)" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="98" fill="url(#radar-bg)" stroke="hsl(172 78% 47% / 0.35)" strokeWidth="0.6" />
      {[24, 48, 72].map(r => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="hsl(172 78% 47% / 0.16)" strokeWidth="0.5" />)}
      <line x1="2" y1="100" x2="198" y2="100" stroke="hsl(172 78% 47% / 0.14)" strokeWidth="0.5" />
      <line x1="100" y1="2" x2="100" y2="198" stroke="hsl(172 78% 47% / 0.14)" strokeWidth="0.5" />
      {Array.from({ length: 36 }, (_, i) => {
        const a = (i * 10 * Math.PI) / 180;
        const r1 = i % 3 === 0 ? 92 : 95;
        return <line key={i} x1={100 + r1 * Math.cos(a)} y1={100 + r1 * Math.sin(a)} x2={100 + 98 * Math.cos(a)} y2={100 + 98 * Math.sin(a)} stroke="hsl(172 78% 47% / 0.4)" strokeWidth="0.5" />;
      })}
    </svg>
    {/* The sweep. */}
    <div
      className="absolute inset-[1%] rounded-full motion-safe:animate-[spin_4.5s_linear_infinite]"
      style={{ background: 'conic-gradient(from 0deg, hsl(172 78% 47% / 0.32), hsl(172 78% 47% / 0.0) 70deg, transparent 360deg)' }}
    />
    {/* Contacts: responders (teal) and one SOS (red). */}
    {[
      { x: 32, y: 38, c: 'bg-primary shadow-[0_0_10px_hsl(var(--glow))]' },
      { x: 64, y: 30, c: 'bg-primary shadow-[0_0_10px_hsl(var(--glow))]' },
      { x: 70, y: 66, c: 'bg-primary shadow-[0_0_10px_hsl(var(--glow))]' },
      { x: 44, y: 58, c: 'bg-[hsl(var(--danger))] text-[hsl(var(--danger))] sonar' },
    ].map((b, i) => (
      <span key={i} className={`absolute w-2 h-2 -ml-1 -mt-1 rounded-full ${b.c}`} style={{ left: `${b.x}%`, top: `${b.y}%` }} />
    ))}
  </div>
);
