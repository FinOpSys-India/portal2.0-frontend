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
    <ParamPill
      param="company"
      all={first}
      options={rest}
      label="Company"
      menuLabel="Scope to company"
    />
  );
}
