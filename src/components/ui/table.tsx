"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        // Light purple on hover, matching the sidebar. Duration and easing are
        // the module's, so a row and a nav item feel like the same surface.
        "border-b transition-colors duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-accent has-aria-expanded:bg-accent data-[state=selected]:bg-accent",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-12 px-4 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

/**
 * A CEILING ON EVERY CELL, so no value can break the page it is drawn on.
 *
 * `whitespace-nowrap` is right for the names, dates and badges these tables
 * hold, and catastrophic without a cap: text that cannot wrap has a min-content
 * width as wide as the string, nothing in the layout may shrink below
 * min-content, and so one 200-character task description pushed a project page
 * 200px wider than the viewport and slid the 320px rail on top of the table.
 * With the cap that page measures 2560px — exactly the viewport.
 *
 * AN OVERFLOW GUARD, NOT A COLUMN WIDTH. These tables are `w-full` under
 * `table-layout: auto`, and once the required widths are met the browser hands
 * every remaining pixel to the column with the largest max-content — `max-width`
 * on a cell does not bind during that distribution. The same description cell
 * measured 1062px wide with this 384px cap in force. What the cap does is trim
 * the column's preferred width enough that the table no longer demands more
 * than the page has. A column that needs a real width says so with `w-*` in its
 * `className`, which lands on the header cell and is what the distribution is
 * computed against.
 *
 * The cap only bites what would have broken the layout anyway. 24rem is far
 * past the longest real value in the product — an email such as
 * `testuser1_bookkeepingspecialist@finopsys.ai` sits well inside it — so
 * ordinary rows are untouched and the ellipsis appears only where the
 * alternative was a broken page. The full text stays reachable: the task tables
 * open a row in a dialog.
 *
 * NOT ON A SPANNING CELL. The empty-state row is one `colSpan` cell carrying a
 * centred sentence across the whole table; capped, it would centre that
 * sentence inside the first 24rem and leave the rest of the row blank.
 *
 * ponytail: ONE CAP FOR EVERY COLUMN, not a width per column. A table whose
 * columns genuinely all run long could still total more than the screen — the
 * container's `overflow-x-auto` is the backstop, and a per-column width is the
 * fix if one table ever needs it.
 */
function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "max-w-96 overflow-hidden px-4 py-4 align-middle text-ellipsis whitespace-nowrap [&[colspan]]:max-w-none [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
