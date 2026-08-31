"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CompanySwitcher } from "@/components/portal/company-switcher";
import {
  AccountMenu,
  NotificationBell,
} from "@/components/portal/portal-chrome";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";
import { ScopeMemory } from "@/components/portal/scope-memory";
import type { PillOption } from "@/components/portal/workspace-pill";

/**
 * The frame for the two portals whose reader works across companies: the
 * accounting manager and the specialist.
 *
 * Picking a company scopes the whole portal, not just the page you were on, so
 * the selection rides in `?company=` on every nav link. `profileHref` is the
 * one exception — that page is the reader's own record — but its link still
 * carries the scope, or visiting it would drop the selection.
 *
 * There is no unscoped state: the reader is always inside one company, the
 * first on their book until they pick another, which is 1.0's rule (its
 * All Companies option is a disabled placeholder). Pages resolve the same
 * default through `companyScope`.
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
  /**
   * The bell, as a node rather than a number.
   *
   * A count forces the layout to have finished counting before the frame can
   * paint, and in the manager's case counting means sweeping the conversations
   * of every company it holds — eight requests to put one digit on an icon,
   * ahead of the nav, the page and everything the reader actually came for.
   * Taking the rendered bell instead lets a layout hand over a Suspense
   * boundary and let the number arrive late.
   */
  notifications?: React.ReactNode;
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
  return (
    <>
      <ScopeMemory known={props.companies.map((c) => c.id)} />
      <Shell {...props} company={useSearchParams().get("company") ?? ""} />
    </>
  );
}

function Shell({
  home,
  groupLabel,
  nav,
  profileHref,
  user,
  companies,
  notifications,
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
          {notifications ?? <NotificationBell count={0} />}
          <AccountMenu user={user} profileHref={`${profileHref}${query}`} />
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
