import { cn } from "@/lib/utils";

/**
 * Titled group of read-only rows.
 *
 * Laid out against the CARD's width, not the viewport's (`@container`). The same
 * section is used full-width on a detail page and inside a 320px side rail, and
 * a viewport breakpoint cannot tell those apart: `sm:grid-cols-2` gave the rail
 * two columns roughly 130px wide, which is narrower than the email address that
 * has to fit in one of them.
 */
export function DetailSection({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  /** For the caller that has to place it — a rail that fills the page, say. */
  className?: string;
}) {
  return (
    <section
      className={cn(
        "@container rounded-xl border border-border bg-card p-6",
        className,
      )}
    >
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <dl className="grid gap-x-8 gap-y-4 @sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/**
 * One field. Empty values render an em dash rather than a blank gap, so a
 * missing value is visibly missing instead of looking like a layout bug.
 *
 * Two shapes, from the one container query above: in a narrow card the field is
 * a row — label left, value right — so the panel reads as a list down the rail;
 * once the card is wide enough for two columns the value sits under its label,
 * which is what the full-width detail pages have always shown.
 */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    // A grid item's floor is its min-content width, and an email address is one
    // unbreakable word — so without `min-w-0` the column refuses to shrink and
    // the value runs out past the card instead of wrapping inside it.
    <div className="flex min-w-0 items-baseline justify-between gap-4 @sm:block">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words @sm:mt-0.5 @sm:text-left">
        {value?.trim() ? (
          value
        ) : (
          <span className="font-normal text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}
