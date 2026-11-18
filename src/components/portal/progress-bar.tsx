/**
 * Project progress: a ring with the percentage beside it (15 Nov), replacing
 * 1.0's filled bar. Narrower, so the Projects table has room for its Actions
 * column.
 */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  // r = 9 in a 24 box: the circumference is what the dash pattern counts in.
  const circumference = 2 * Math.PI * 9;

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% complete`}
      className="inline-flex items-center gap-2"
    >
      <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden>
        <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" className="stroke-border" />
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          className={`transition-[stroke-dashoffset] duration-300 ${
            pct === 0 ? "stroke-transparent" : "stroke-primary"
          }`}
        />
      </svg>
      <span className="text-sm font-medium tabular-nums">{pct}%</span>
    </div>
  );
}
