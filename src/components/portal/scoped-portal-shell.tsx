"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CompanySwitcher } from "@/components/portal/company-switcher";
import {
  AccountMenu,
  NotificationBell,
} from "@/components/portal/portal-chrome";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";
import type { PillOption } from "@/components/portal/workspace-pill";

/**
 * The frame for the two portals whose reader works across companies: the
 * accounting manager and the specialist.
 *
 * Picking a company scopes the whole portal until it is cleared, not just the
 * page you were on, so the selection rides in `?company=` on every nav link.
 * `profileHref` is the one exception — that page is the reader's own record —
 * but its link still carries the scope, or visiting it would clear the
 * selection and leaving it would land you back on All companies.
 *
 * Defaults to All companies rather than a single one. 1.0 disables its
 * All Companies option once you pick one, leaving no way back to the full book.
 *
 * The manager and specialist shells were this same 68-line scaffold twice, in
 * two files, differing only in the arguments below.
 */
export type ScopedShellProps = {
  /** Where the logo links to, unscoped. */
  home: string;
  groupLabel?: string;
  nav: NavItem[];
  /** The reader's own record, which the scope does not filter. */
  profileHref: string;
  user: { name: string; email: string };
  companies: PillOption[];
  notificationCount?: number;
  children: React.ReactNode;
};

export function ScopedPortalShell(props: ScopedShellProps) {
  return (
    // useSearchParams client-renders everything up to the nearest boundary.
    // The fallback is the same shell with unscoped links, so the frame paints
    // immediately and hydration only rewrites the hrefs.
    <Suspense fallback={<Shell {...props} company="" />}>
      <Scoped {...props} />
    </Suspense>
  );
}

function Scoped(props: ScopedShellProps) {
  return <Shell {...props} company={useSearchParams().get("company") ?? ""} />;
}

function Shell({
  home,
  groupLabel,
  nav,
  profileHref,
  user,
  companies,
  notificationCount = 0,
  company,
  children,
}: ScopedShellProps & { company: string }) {
  const query = company ? `?company=${encodeURIComponent(company)}` : "";

  return (
    <PortalShell
      home={`${home}${query}`}
      groupLabel={groupLabel}
      nav={nav.map((item) => ({ ...item, href: `${item.href}${query}` }))}
      headerRight={
        <>
          <CompanySwitcher companies={companies} />
          <NotificationBell count={notificationCount} />
          <AccountMenu user={user} profileHref={`${profileHref}${query}`} />
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
