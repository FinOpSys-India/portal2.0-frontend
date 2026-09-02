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
 * Six items, in the design's order (docs/specialist-portal.md). No Customer and
 * no Specialist entry — a specialist talks to their accounting manager and
 * nobody else — plus a Tasks entry the manager does not have.
 *
 * Labels are the destinations' own headings, matching the manager's sidebar
 * item for item. The design's names were three different words for the same
 * screen across the two staff portals — "File Organizer" here, "File" there,
 * one page — and a label that changes with the portal is a label that teaches
 * nothing.
 */
const NAV: NavItem[] = [
  { href: "/specialist/projects", label: "Projects", icon: FolderKanban },
  { href: "/specialist/tasks", label: "Tasks", icon: ClipboardList },
  { href: "/specialist/companies", label: "Companies", icon: Building2 },
  { href: "/specialist/documents", label: "All Documents", icon: FileText },
  { href: "/specialist/connect", label: "Connect", icon: MessageSquare },
  { href: "/specialist/profile", label: "User Info", icon: UserRound },
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
