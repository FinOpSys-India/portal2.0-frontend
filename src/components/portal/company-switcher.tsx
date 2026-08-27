"use client";

import { ParamPill } from "@/components/portal/param-pill";
import type { PillOption } from "@/components/portal/workspace-pill";

/** Cleared scope. Empty id means "no ?company= on the URL". */
const ALL: PillOption = { id: "", name: "All companies" };

/**
 * Company switcher in the manager's top bar.
 *
 * ponytail: the param only survives while you stay on a page — the sidebar
 * links are plain hrefs, so navigating resets to All companies. Thread it
 * through PortalShell's nav if the reset starts costing clicks.
 */
export function CompanySwitcher({ companies }: { companies: PillOption[] }) {
  return (
    <ParamPill
      param="company"
      all={ALL}
      options={companies}
      label="Company"
      menuLabel="Scope to company"
    />
  );
}
