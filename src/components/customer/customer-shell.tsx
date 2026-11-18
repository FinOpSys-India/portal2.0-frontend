"use client";

import * as React from "react";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  BookOpen,
  Building2,
  CreditCard,
  FolderKanban,
  Folders,
  MessageSquare,
  Paperclip,
  Receipt,
  UserRound,
  Users,
} from "lucide-react";

import {
  useNewCounts,
  type ServicePage,
} from "@/components/customer/use-new-counts";
import { LiveBell } from "@/components/portal/live-bell";
import { AccountMenu } from "@/components/portal/portal-chrome";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";
import { SwitchLabel, WorkspacePill } from "@/components/portal/workspace-pill";
import type { Workspace } from "@/lib/customer";
import {
  parseServiceTab,
  SERVICE_TABS,
  serviceHref,
  type ServiceTab,
} from "@/lib/portal";

/**
 * Labels are the destinations' own headings, as in the staff portals.
 *
 * "Company" stays singular against the plural rule because the destination is
 * singular: a customer has exactly one company here, and the page is titled
 * "Company". The rule is that a label names where it goes — pluralising this
 * one would promise a list that does not exist.
 */
const SEGMENTS = [
  { segment: "projects", label: "Projects", icon: FolderKanban },
  { segment: "connect", label: "Connect", icon: MessageSquare },
  { segment: "files", label: "Documents", icon: Paperclip },
  { segment: "company", label: "Companies", icon: Building2 },
  { segment: "team", label: "Team", icon: Users },
  // OWNER-ONLY, and hidden rather than shown-and-refused: `GET
  // /billing/subscription` 403s a teammate (see `billingAccess.js`), so the row
  // led every invited teammate to a page that could only tell them no. The page
  // itself still answers on a direct URL — hiding the link is not the gate.
  { segment: "billing", label: "Billing", icon: CreditCard, ownerOnly: true },
  { segment: "profile", label: "Profile", icon: UserRound },
];

/**
 * A company's services are its sidebar: each one it pays for is a row with its
 * own Projects and Documents under it, in place of the two flat rows above.
 * They are the same two pages, narrowed by `?service=`.
 */
const SERVICE_ICONS = {
  all: FolderKanban,
  bookkeeping: BookOpen,
  payroll: Banknote,
  tax: Receipt,
  other: Folders,
} satisfies Record<ServiceTab, NavItem["icon"]>;

const SERVICE_PAGES: { segment: ServicePage; label: string }[] = [
  { segment: "projects", label: "Projects" },
  { segment: "files", label: "Documents" },
];

/** What the flat rows count over, when a company has no service rows. */
const UNSPLIT: ServiceTab[] = ["all"];

/**
 * Tells the counts which list the reader has open, so its number clears. The
 * list itself only: a project page beneath it has shown them nothing new.
 *
 * Its own component because `useSearchParams` has to sit inside a Suspense
 * boundary, and it renders nothing, so the boundary costs nothing.
 */
function VisitWatcher({
  root,
  onVisit,
}: {
  root: string;
  onVisit: (key: string) => void;
}) {
  const pathname = usePathname();
  const service = useSearchParams().get("service");

  React.useEffect(() => {
    const page = SERVICE_PAGES.find((p) => pathname === `${root}/${p.segment}`);
    if (page) {
      onVisit(`${parseServiceTab(service ?? undefined)}:${page.segment}`);
    }
  }, [pathname, service, root, onVisit]);

  return null;
}

/**
 * Customer portal frame.
 *
 * The workspace stays in the URL as /customer/[workspace]/… rather than in
 * client state. 1.0 keeps it in a dropdown whose selection is lost on reload,
 * which is how you end up reading the wrong company's data without noticing.
 */
export function CustomerShell({
  workspace,
  workspaces,
  unpaid,
  user,
  owner,
  services = [],
  children,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  /** Company ids with no subscription yet — tagged in the switcher. */
  unpaid?: string[];
  user: { name: string; email: string; avatarUrl?: string | null };
  /**
   * Does this reader OWN the company on screen — not own something somewhere.
   * A customer can own one company and be a teammate on another, so the test is
   * per workspace, exactly as the Team page gates its invite button.
   */
  owner: boolean;
  /**
   * The service groups to draw, in order — see `serviceGroups` in lib/portal.
   * None (a company with no subscription and no projects) leaves the flat
   * Projects and Documents rows, so the lists are never without a way in.
   */
  services?: ServiceTab[];
  children: React.ReactNode;
}) {
  const router = useRouter();

  const root = `/customer/${workspace.id}`;

  // The numbers beside the rows: new work under a service, unread chat on
  // Connect. See `useNewCounts` for what "new" means and where it is kept.
  const counts = useNewCounts(workspace, services.length ? services : UNSPLIT);
  const added = (tab: ServiceTab, page: ServicePage) => {
    const count = counts.added(tab, page);
    return count ? { count, label: "new" } : undefined;
  };

  const groups: NavItem[] = services.map((tab) => {
    const pages = SERVICE_PAGES.map((page) => ({
      href: serviceHref(`${root}/${page.segment}`, tab),
      label: page.label,
      query: { service: tab },
      badge: added(tab, page.segment),
    }));
    return {
      // The row opens its first page: on the collapsed rail it is all there is.
      href: pages[0].href,
      label: SERVICE_TABS.find((t) => t.tab === tab)?.label ?? tab,
      icon: SERVICE_ICONS[tab],
      children: pages,
    };
  });

  const nav: NavItem[] = [
    ...groups,
    ...SEGMENTS.filter(
      (item) =>
        (owner || !item.ownerOnly) &&
        !(
          groups.length && SERVICE_PAGES.some((p) => p.segment === item.segment)
        ),
    ).map((item) => {
      const page = SERVICE_PAGES.find((p) => p.segment === item.segment);
      return {
        href: `${root}/${item.segment}`,
        label: item.label,
        icon: item.icon,
        badge: page
          ? added("all", page.segment)
          : item.segment === "connect" && counts.unread
            ? { count: counts.unread, label: "unread" }
            : undefined,
      };
    }),
  ];

  return (
    <PortalShell
      home={`/customer/${workspace.id}/projects`}
      groupLabel="Workspace"
      nav={nav}
      headerRight={
        <>
          <SwitchLabel />
          <WorkspacePill
            current={workspace}
            options={workspaces}
            unpaid={unpaid}
            // An unpaid company has no portal to switch into — its projects
            // page is a frame around nothing until there is a subscription —
            // so the switcher goes where its tag says, as the picker and the
            // Company table do.
            onSelect={(id) =>
              router.push(
                unpaid?.includes(id)
                  ? `/on_boarding_form_part_2?compID=${encodeURIComponent(id)}`
                  : `/customer/${id}/projects`,
              )
            }
          />
          {/* A client component, so it mounts once and survives every
              navigation under this shell instead of sweeping again on each
              one. Here rather than in the layout so its sweep can feed the
              sidebar's numbers too. See LiveBell. */}
          <LiveBell
            companies={workspaces.filter((w) => !w.inactive)}
            hrefFor="customer"
            onLoad={counts.onBell}
          />
          <AccountMenu
            user={user}
            profileHref={`/customer/${workspace.id}/profile`}
          />
        </>
      }
    >
      <React.Suspense>
        <VisitWatcher root={root} onVisit={counts.onVisit} />
      </React.Suspense>
      {children}
    </PortalShell>
  );
}
