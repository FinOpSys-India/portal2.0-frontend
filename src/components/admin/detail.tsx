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
  /** A node for a field that is more than text — a deadline with its flag. */
  value: React.ReactNode;
}) {
  // Only a string can be blank-but-present; a node the caller built is content.
  const empty = value == null || (typeof value === "string" && !value.trim());

  return (
    // A grid item's floor is its min-content width, and an email address is one
    // unbreakable word — so without `min-w-0` the column refuses to shrink and
    // the value runs out past the card instead of wrapping inside it.
    <div className="flex min-w-0 items-baseline justify-between gap-4 @sm:block">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium break-words @sm:mt-0.5 @sm:text-left">
        {empty ? (
          <span className="font-normal text-muted-foreground">—</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

/**
 * A detail page while it fetches: the header (avatar, name, email) and two
 * sections of fields, in the places the real ones land, so nothing jumps.
 *
 * Each detail folder's `loading.tsx` renders this. One higher up does not
 * cover a row click: list to detail changes only the `[email]` / `[id]`
 * segment, and a loading boundary shows only for the segment it sits in.
 */
export function DetailSkeleton() {
  const bar = "animate-pulse rounded bg-muted";
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="mb-6 flex items-center gap-2.5">
        <div className={cn(bar, "size-11 rounded-full")} />
        <div className="space-y-2">
          <div className={cn(bar, "h-6 w-48")} />
          <div className={cn(bar, "h-4 w-64")} />
        </div>
      </div>
      <div className="grid gap-6">
        {[6, 4].map((fields, i) => (
          <section key={i} className="rounded-xl border border-border bg-card p-6">
            <div className={cn(bar, "mb-4 h-4 w-40")} />
            <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {Array.from({ length: fields }, (_, j) => (
                <div key={j} className="space-y-1.5">
                  <div className={cn(bar, "h-3.5 w-24")} />
                  <div className={cn(bar, "h-4 w-40")} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
