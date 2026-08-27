/**
 * Project progress, as 1.0 renders it: a filled bar with the percentage
 * sitting inside it.
 *
 * 1.0 prints the number twice per row (once inside the bar, once beside it).
 * Once here — the duplicate is a Bubble artifact, not a design.
 */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${pct}% complete`}
      className="relative h-6 w-40 overflow-hidden rounded-full border border-border bg-card"
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
      <span className="absolute inset-0 grid place-items-center text-xs font-medium tabular-nums">
        {pct}%
      </span>
    </div>
  );
}
