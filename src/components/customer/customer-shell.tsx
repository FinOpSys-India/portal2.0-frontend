"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  FolderKanban,
  MessageSquare,
  Paperclip,
  UserRound,
  Users,
} from "lucide-react";

import { AccountMenu, NotificationBell } from "@/components/portal/portal-chrome";
import { PortalShell, type NavItem } from "@/components/portal/portal-shell";
import { WorkspacePill } from "@/components/portal/workspace-pill";
import type { Workspace } from "@/lib/customer";

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
  { segment: "files", label: "All Documents", icon: Paperclip },
  { segment: "company", label: "Company", icon: Building2 },
  { segment: "team", label: "Team", icon: Users },
  { segment: "profile", label: "Profile", icon: UserRound },
];

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
  user,
  notificationCount = 0,
  children,
}: {
  workspace: Workspace;
  workspaces: Workspace[];
  user: { name: string; email: string };
  notificationCount?: number;
  children: React.ReactNode;
}) {
  const router = useRouter();

  const nav: NavItem[] = SEGMENTS.map((item) => ({
    href: `/customer/${workspace.id}/${item.segment}`,
    label: item.label,
    icon: item.icon,
  }));

  return (
    <PortalShell
      home={`/customer/${workspace.id}/projects`}
      groupLabel="Workspace"
      nav={nav}
      headerRight={
        <>
          <WorkspacePill
            current={workspace}
            options={workspaces}
            onSelect={(id) => router.push(`/customer/${id}/projects`)}
          />
          <NotificationBell count={notificationCount} />
          <AccountMenu
            user={user}
            profileHref={`/customer/${workspace.id}/profile`}
          />
        </>
      }
    >
      {children}
    </PortalShell>
  );
}
