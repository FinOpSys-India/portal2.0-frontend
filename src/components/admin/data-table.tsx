// Intentionally a Server Component: the pages pass `cell` render functions in
// their column definitions, and functions cannot cross the server/client
// boundary. Nothing here needs hooks, so it stays on the server and only the
// interactive bits inside cells ship JS.
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { SortLink } from "@/components/admin/sort-link";

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

export type SortableColumn<T> = {
  header: string;
  cell?: (row: T) => React.ReactNode;
  sortValue?: ((row: T) => string | number) | false;
  /** Header cell classes, for the columns the detail pages right-align. */
  className?: string;
};

export type Column<T> = {
  header: string;
  /** Cell contents. Return a string for plain text or a node for anything else. */
  cell: (row: T) => React.ReactNode;
  /**
   * What this column sorts on. Defaults to the text the cell renders, which is
   * what the reader sees and therefore what they expect to be sorted — EXCEPT
   * for dates: 1.0 writes them M/DD/YY, and "8/03/26" sorts before "7/28/26" as
   * text. Those columns pass a timestamp.
   *
   * `false` drops the header link, for columns nothing can be ordered by
   * (avatar stacks, a menu).
   */
  sortValue?: ((row: T) => string | number) | false;
};

/**
 * The text a cell renders, walked out of the node it returns.
 *
 * Saves every column definition in the app having to repeat its own field as a
 * sort key. Client components come back empty — their children are rendered on
 * the far side of the boundary — which is why those columns pass `sortValue`
 * or opt out.
 */
export function cellText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(cellText).join(" ");
  if (React.isValidElement(node)) {
    return cellText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

/**
 * Rows in the order `?sort=` and `?dir=` ask for.
 *
 * An unknown column name leaves the order alone rather than erroring: the sort
 * comes off the URL, so it is whatever someone typed or whatever a bookmark
 * kept after a column was renamed.
 *
 * ponytail: sorts the rows the table was handed. The four admin lists are
 * paged by the backend, so theirs is the current page — `GET /customers` and
 * friends take no sort param, and adding one is a backend change.
 *
 * Exported for the test.
 */
export function sortRows<T>(
  rows: T[],
  columns: SortableColumn<T>[],
  sort?: string,
  dir?: string,
): T[] {
  const column = columns.find((c) => c.header === sort);
  if (!column || column.sortValue === false) return rows;

  const cell = column.cell;
  const value =
    column.sortValue ?? ((row: T) => (cell ? cellText(cell(row)) : ""));
  const sign = dir === "desc" ? -1 : 1;

  return [...rows].sort((a, b) => {
    const [x, y] = [value(a), value(b)];
    if (typeof x === "number" && typeof y === "number") return sign * (x - y);
    // `numeric` so "Project 10" lands after "Project 9", and blanks last in
    // both directions — an empty cell is the absence of a value, not the
    // smallest one.
    if (!x !== !y) return !x ? 1 : -1;
    return (
      sign *
      String(x).localeCompare(String(y), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
  });
}

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

/** The header row, with a sort link on every column that has something to sort by. */
export function SortableHeadRow<T>({
  columns,
  sort,
  dir,
}: {
  columns: SortableColumn<T>[];
  sort?: string;
  dir?: string;
}) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        {columns.map((column) => {
          const active = column.header === sort;
          const direction = dir === "desc" ? "desc" : "asc";

          return (
            <TableHead
              key={column.header}
              className={column.className}
              aria-sort={
                active
                  ? direction === "desc"
                    ? "descending"
                    : "ascending"
                  : undefined
              }
            >
              {column.sortValue === false ? (
                column.header
              ) : (
                <SortLink column={column.header} dir={active ? direction : null} />
              )}
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
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
  sort,
  dir,
}: {
  columns: Column<T>[];
  rows: T[];
  total: number;
  page: number;
  /** Column header to sort by, straight off `?sort=`. */
  sort?: string;
  /** `asc` unless this says `desc`. */
  dir?: string;
  /** Path used to build page links, e.g. /admin/customers. */
  basePath: string;
  /** Makes a row clickable. Omit for lists with no detail view. */
  rowHref?: (row: T) => string;
  /** Title and actions rendered inside the card, above the table. */
  header?: React.ReactNode;
  empty: string;
}) {
  // Sorted before the window is taken, so ordering spans every page the table
  // was handed rather than shuffling the ten rows on screen.
  const { shown, current, pages, first, last } = pageWindow(
    sortRows(rows, columns, sort, dir),
    total,
    page,
  );

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {header ? (
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-6">
            {header}
          </div>
        ) : null}

        <Table>
          <SortableHeadRow columns={columns} sort={sort} dir={dir} />
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
