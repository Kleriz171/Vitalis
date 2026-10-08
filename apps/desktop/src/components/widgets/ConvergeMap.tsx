/**
 * Login illustration: a line drawing of central Tirana's ring and axes with an SOS and two
 * responders closing in on it. What Vitalis does, in one picture.
 */
export const ConvergeMap = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 520 380" className={className} fill="none" aria-hidden>
    <g stroke="#fff" strokeOpacity="0.16" strokeWidth="1.5" strokeLinecap="round">
      <ellipse cx="262" cy="190" rx="150" ry="118" />
      <ellipse cx="262" cy="190" rx="82" ry="64" strokeOpacity="0.1" />
      <path d="M262 10v360M40 196c80-10 140-8 222-6s150 4 238-6M80 40l360 300M455 52 70 330" />
      <path d="M10 120c90 20 160 10 252 70M262 190c70 40 120 120 140 180M120 360c40-70 90-130 142-170" strokeOpacity="0.1" />
      {/* the river (Lana) */}
      <path d="M0 236c70-18 120 14 190-6s110-40 180-22 100 30 150 20" stroke="#14A897" strokeOpacity="0.45" strokeWidth="2" />
    </g>
    {/* responder routes */}
    <path d="M118 96c40 30 70 54 120 84" stroke="#14A897" strokeWidth="2" strokeDasharray="5 6" className="motion-safe:animate-[dash_2.4s_linear_infinite]" />
    <path d="M410 300c-50-30-90-60-140-100" stroke="#14A897" strokeWidth="2" strokeDasharray="5 6" className="motion-safe:animate-[dash_2.4s_linear_infinite]" />
    <circle cx="118" cy="96" r="7" fill="#14A897" stroke="#fff" strokeWidth="2.5" />
    <circle cx="410" cy="300" r="7" fill="#14A897" stroke="#fff" strokeWidth="2.5" />
    {/* the SOS */}
    <circle cx="258" cy="192" r="26" fill="#D92D2D" fillOpacity="0.18" className="motion-safe:animate-[ping-soft_2s_cubic-bezier(0.16,1,0.3,1)_infinite] origin-[258px_192px]" />
    <circle cx="258" cy="192" r="10" fill="#D92D2D" stroke="#fff" strokeWidth="3" />
    <g fill="#fff" fillOpacity="0.75" fontFamily="Inter Variable, system-ui" fontSize="12">
      <text x="276" y="172">SOS · cardiac arrest</text>
      <text x="86" y="78">Responder · 2 min</text>
      <text x="360" y="328">Defibrillator runner</text>
    </g>
  </svg>
);
