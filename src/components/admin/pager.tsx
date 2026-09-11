"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { PAGE_SIZE, PAGE_SIZES, parsePageSize } from "@/lib/admin";
import { cn } from "@/lib/utils";

/**
 * The pager's own query string: every param already on the URL, plus the ones
 * passed here — `undefined` removes one.
 *
 * Client only for the same reason `SortLink` is: the tables are Server
 * Components and cannot read the query string, so a link built from a path
 * alone dropped the sort, the filters and the company scope every list pages
 * beside. Turning to page 2 used to reset all three.
 */
function useTableHref() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return React.useCallback(
    (changes: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      return query ? `${pathname}?${query}` : pathname;
    },
    [pathname, searchParams],
  );
}

/** Previous/next arrow, or a dead one at either end of the list. */
export function PageLink({
  page,
  disabled,
  label,
  children,
}: {
  page: number;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const linkFor = useTableHref();
  const href = linkFor({ page: String(page) });

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
      // The rows redraw in place; jumping to the top of the document would
      // lose the reader's position in a long list.
      scroll={false}
      className={cn(
        className,
        "hover:border-primary/25 hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * How many rows the table shows, written to `?size=`.
 *
 * A `<datalist>` rather than a select: the common counts are one click away
 * AND any number can be typed, which is the whole ask — a select would need a
 * "Custom…" branch and an input beside it to do the same job.
 *
 * Commits on blur and on Enter, not on every keystroke: typing "100" passes
 * through "1" and "10", and each of those would otherwise reload the table.
 */
export function PageSizeBox({ size }: { size: number }) {
  const router = useRouter();
  const linkFor = useTableHref();
  const id = React.useId();

  function commit(input: HTMLInputElement) {
    const next = parsePageSize(input.value);
    // Snap the box to what was actually applied, so a typed "999" or "abc"
    // does not sit there claiming something the table is not doing.
    input.value = String(next);
    if (next === size) return;
    router.push(
      // A different window renumbers the pages: row 11 is on page 2 of ten and
      // page 1 of twenty-five, so the count change lands back at the start.
      linkFor({
        size: next === PAGE_SIZE ? undefined : String(next),
        page: undefined,
      }),
      { scroll: false },
    );
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      Rows
      <Input
        id={id}
        // Uncontrolled, keyed by the count in the URL: the box holds whatever
        // is being typed, and a size changed from anywhere else — the Back
        // button, another table on the page — remounts it with the new one.
        key={size}
        defaultValue={size}
        type="number"
        inputMode="numeric"
        min={1}
        max={Math.max(...PAGE_SIZES)}
        list={`${id}-options`}
        onBlur={(event) => commit(event.currentTarget)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit(event.currentTarget);
          }
        }}
        className="h-9 w-20 tabular-nums"
      />
      <datalist id={`${id}-options`}>
        {PAGE_SIZES.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  );
}
