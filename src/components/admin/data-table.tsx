// Intentionally a Server Component: the pages pass `cell` render functions in
// their column definitions, and functions cannot cross the server/client
// boundary. Nothing here needs hooks, so it stays on the server and only the
// interactive bits inside cells ship JS.
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_SIZE } from "@/lib/admin";
import { cn } from "@/lib/utils";

export type Column<T> = {
  header: string;
  /** Cell contents. Return a string for plain text or a node for anything else. */
  cell: (row: T) => React.ReactNode;
};

/**
 * Which rows this page shows, and what the pager reads.
 *
 * CALLERS ARRIVE IN TWO SHAPES, and telling them apart is the whole job here.
 * The admin lists page on the SERVER: they request one page worth of rows and
 * hand over exactly that, with `total` counting the rest. The customer lists
 * fetch the whole (capped) set in one request and hand over all of it.
 *
 * So slicing happens only when there is more than one page of rows to slice —
 * which serves the second kind without double-paging the first. Before this,
 * the second kind rendered every row it had beneath a pager that computed
 * several pages out of `total`, so Next changed the URL and nothing else. That
 * was five screens in the customer portal.
 *
 * Exported for the test: it is the one piece of arithmetic here that can be
 * wrong without looking wrong.
 */
export function pageWindow<T>(rows: T[], total: number, page: number) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Clamped, so a hand-typed ?page=99 lands on the last page rather than on an
  // empty table that reads as "this list is broken".
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pages);

  return {
    pages,
    current,
    first: total === 0 ? 0 : (current - 1) * PAGE_SIZE + 1,
    last: Math.min(current * PAGE_SIZE, total),
    shown:
      rows.length > PAGE_SIZE
        ? rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)
        : rows,
  };
}

/**
 * Paginated table for the admin lists.
 *
 * Pagination is the one intentional addition to 1.0, which renders every row
 * on one page with no paging, search or sort. Fine at four customers, not at
 * four hundred.
 */
export function DataTable<T>({
  columns,
  rows,
  total,
  page,
  basePath,
  rowHref,
  header,
  empty,
}: {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  /** Path used to build page links, e.g. /admin/customers. */
  basePath: string;
  /** Makes a row clickable. Omit for lists with no detail view. */
  rowHref?: (row: T) => string;
  /** Title and actions rendered inside the card, above the table. */
  header?: React.ReactNode;
  empty: string;
}) {
  const { shown, current, pages, first, last } = pageWindow(rows, total, page);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {header ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
            {header}
          </div>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.header}>
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-sm text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              shown.map((row, index) => {
                const href = rowHref?.(row);
                return (
                  <TableRow
                    key={index}
                    // `relative` is load-bearing: the stretched row link below
                    // is `absolute inset-0`, and without a positioned row it
                    // resolves against a far ancestor and covers the whole
                    // table — making every row navigate to the last one.
                    className={cn(href && "relative cursor-pointer")}
                  >
                    {columns.map((column, columnIndex) => (
                      <TableCell key={column.header}>
                        {/* The link wraps the first cell's content and is
                            stretched across the row, so the whole row is
                            clickable while remaining one real anchor for
                            keyboard and middle-click. */}
                        {href && columnIndex === 0 ? (
                          <Link
                            href={href}
                            className="after:absolute after:inset-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
                          >
                            {column.cell(row)}
                          </Link>
                        ) : (
                          column.cell(row)
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {total > 0 ? (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            Showing {first}–{last} of {total}
          </p>

          <div className="flex items-center gap-2">
            <PageLink
              href={`${basePath}?page=${current - 1}`}
              disabled={current <= 1}
              label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </PageLink>
            <span className="text-sm tabular-nums">
              {current} / {pages}
            </span>
            <PageLink
              href={`${basePath}?page=${current + 1}`}
              disabled={current >= pages}
              label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden />
            </PageLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "inline-flex size-9 items-center justify-center rounded-lg border border-border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30";

  if (disabled) {
    return (
      <span
        aria-disabled
        aria-label={label}
        className={cn(className, "pointer-events-none opacity-40")}
      >
        {children}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        className,
        "hover:border-primary/25 hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/** Comma-joined list with a muted dash when empty. */
export function ListCell({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }
  return <span>{items.join(", ")}</span>;
}

/**
 * Each item as its own chip.
 *
 * Used where a customer can belong to more than one company: joining them
 * with a comma reads as a single name that happens to contain a comma, which
 * is exactly the wrong impression when the point is that these are separate
 * companies.
 */
export function ChipsCell({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {items.map((item) => (
        <span
          key={item}
          className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {item}
        </span>
      ))}
    </span>
  );
}
