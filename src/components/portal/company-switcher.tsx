"use client";

import { ParamPill } from "@/components/portal/param-pill";
import type { PillOption } from "@/components/portal/workspace-pill";

/**
 * Company switcher in the manager's top bar.
 *
 * There is no "All companies" entry: the portal reads exactly one company at a
 * time. With no `?company=` on the URL that is the first on the book — the same
 * fallback every page applies through `companyScope`, so the pill and the data
 * under it never disagree.
 */
export function CompanySwitcher({ companies }: { companies: PillOption[] }) {
  const [first, ...rest] = companies;
  // Nothing to scope to, so nothing to show.
  if (!first) return null;

  return (
    // A fragment, not a wrapper: the top bar is already `flex items-center
    // gap-3`, so the label spaces itself against the pill the way every other
    // control in the bar does. Hidden below `sm` — the bar there is the menu
    // trigger, the pill, the bell and the avatar, with no room for prose.
    <>
      <span className="hidden text-sm text-muted-foreground sm:inline">
        Switch Company <span aria-hidden>&rarr;</span>
      </span>
      <ParamPill
        param="company"
        all={first}
        options={rest}
        label="Company"
        menuLabel="Scope to company"
        // Sort is a column name and a page size is a preference, so both mean
        // the same under any company; `party` names which Connect inbox is
        // open, and is not a property of a company either. A page number, a
        // filter set, a project name and a conversation id all belong to the
        // company being left.
        keep={["sort", "dir", "size", "party"]}
      />
    </>
  );
}
