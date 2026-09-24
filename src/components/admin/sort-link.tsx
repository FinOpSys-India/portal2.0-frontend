"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A column header that sorts.
 *
 * Client only for the URL: the tables above are Server Components, so they
 * cannot read the query string themselves, and a header link built from
 * `basePath` alone would drop the company and project filters the lists page
 * beside. Reading `useSearchParams` keeps every other param exactly as it is.
 *
 * The sort itself stays on the server — this only writes `?sort=&dir=`.
 */
export function SortLink({
  column,
  dir,
}: {
  column: string;
  /** The direction this column is sorted in now, or null when it is not. */
  dir: "asc" | "desc" | null;
}) {
  const pathname = usePathname();
  const params = new URLSearchParams(useSearchParams());

  params.set("sort", column);
  params.set("dir", dir === "asc" ? "desc" : "asc");
  // A new order makes the old page numbers meaningless — page 3 of one sort is
  // not page 3 of the next, so sorting always lands back on the first page.
  params.delete("page");

  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ChevronsUpDown;

  return (
    <Link
      href={`${pathname}?${params}`}
      /*
       * NOT PREFETCHED, and that is the point of it being a link at all.
       *
       * This is the SAME page with a different query string, not a destination.
       * Next prefetches every Link in the viewport, and a prefetch runs the
       * target's whole server render — so a table with seven sortable headers
       * re-rendered the page seven times over for orders nobody had asked for.
       * Measured on the customer project detail, which has two tables: fourteen
       * prefetch renders for one page view.
       *
       * The data cache hides the cost today, because every variant reads the
       * same URLs. On a cold cache it is fourteen times the page's reads.
       *
       * What is lost is a head start on the first sort click, which is one
       * render of a page the reader is already looking at.
       */
      prefetch={false}
      // The rows redraw in place; jumping to the top of the document would
      // lose the reader's position in a long list.
      scroll={false}
      className="inline-flex items-center gap-1.5 rounded-md transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
    >
      {column}
      <Icon className={cn("size-3.5 shrink-0", !dir && "opacity-40")} aria-hidden />
    </Link>
  );
}
