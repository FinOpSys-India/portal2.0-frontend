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

const SEGMENTS = [
  { segment: "projects", label: "Projects", icon: FolderKanban },
  { segment: "connect", label: "Connect", icon: MessageSquare },
  { segment: "files", label: "Files", icon: Paperclip },
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
