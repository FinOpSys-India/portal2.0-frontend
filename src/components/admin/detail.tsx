/** Titled group of read-only rows. */
export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="mb-4 text-sm font-semibold">{title}</h2>
      <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/**
 * One field. Empty values render an em dash rather than a blank gap, so a
 * missing value is visibly missing instead of looking like a layout bug.
 */
export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">
        {value?.trim() ? (
          value
        ) : (
          <span className="font-normal text-muted-foreground">—</span>
        )}
      </dd>
    </div>
  );
}
