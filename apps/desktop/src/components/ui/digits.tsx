/**
 * A time like 13:38:39 with fixed-width digits (so it doesn't jitter as it ticks) but normal,
 * tight colons. Schibsted Grotesk's tabular colon is as wide as a digit, which reads "13 : 38".
 */
export const Digits = ({ value, className }: { value: string; className?: string }) => (
  <span className={className}>
    {value.split(':').map((part, i) => (
      <span key={i}>
        {i > 0 && <span className="mx-[0.04em]">:</span>}
        <span className="num">{part}</span>
      </span>
    ))}
  </span>
);
