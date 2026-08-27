"use client";

import {
  Building2,
  ClipboardList,
  FileText,
  FolderKanban,
  MessageSquare,
  UserRound,
} from "lucide-react";

import type { NavItem } from "@/components/portal/portal-shell";
import {
  ScopedPortalShell,
  type ScopedShellProps,
} from "@/components/portal/scoped-portal-shell";

/**
 * Six items, in the design's order and with the design's labels
 * (docs/specialist-portal.md). No Customer and no Specialist entry — a
 * specialist talks to their accounting manager and nobody else — plus a Tasks
 * entry the manager does not have.
 */
const NAV: NavItem[] = [
  { href: "/specialist/projects", label: "Project", icon: FolderKanban },
  { href: "/specialist/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/specialist/companies", label: "Company", icon: Building2 },
  { href: "/specialist/documents", label: "File Organizer", icon: FileText },
  { href: "/specialist/connect", label: "Connect", icon: MessageSquare },
  { href: "/specialist/profile", label: "User", icon: UserRound },
];

/**
 * Specialist portal frame.
 *
 * Same frame as the manager's, switcher included: a specialist's book spans
 * companies, so scoping the portal to one is the same problem and gets the same
 * answer.
 */
export function SpecialistShell(
  props: Omit<
    ScopedShellProps,
    "home" | "groupLabel" | "nav" | "profileHref"
  >,
) {
  return (
    <ScopedPortalShell
      {...props}
      home="/specialist/projects"
      groupLabel="Work"
      nav={NAV}
      profileHref="/specialist/profile"
    />
  );
}
