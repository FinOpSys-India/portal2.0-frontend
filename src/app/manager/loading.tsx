/**
 * What the manager sees while a page fetches.
 *
 * Next wraps the segment's page in a Suspense boundary whenever this file
 * exists, which is the entire reason the portal stopped showing a blank frame:
 * every manager page is an async server component that awaits a per-company
 * sweep, and until one finished there was nothing on the screen but the shell —
 * on a slow link that was fifteen seconds of nothing.
 *
 * Deliberately shaped like the tables it stands in for. A spinner says only
 * "wait"; blocks in the position of the real header and rows keep the layout
 * from jumping when the data lands, which is the difference between a good and
 * a bad CLS score.
 */
function Bar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-neutral-200 dark:bg-neutral-800 ${className}`}
    />
  );
}

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>

      {/* Page header: title on the left, the action button on the right. */}
      <div className="flex items-center justify-between">
        <Bar className="h-7 w-48" />
        <Bar className="h-9 w-32" />
      </div>

      {/* Table: a header row, then rows of steady height. */}
      <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="border-b border-neutral-200 p-3 dark:border-neutral-800">
          <Bar className="h-4 w-full" />
        </div>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="border-b border-neutral-100 p-3 last:border-0 dark:border-neutral-900"
          >
            <Bar className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
