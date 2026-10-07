"use client";

import {
  Building2,
  FileText,
  FolderKanban,
  MessageSquare,
  UserRound,
  Users,
  Wrench,
} from "lucide-react";

import type { NavItem } from "@/components/portal/portal-shell";
import {
  ScopedPortalShell,
  type ScopedShellProps,
} from "@/components/portal/scoped-portal-shell";

/**
 * 1.0's seven items, in 1.0's order.
 *
 * NOT 1.0's labels. 1.0 names five of them in the singular — "Customer",
 * "File" — while every one of those screens is a LIST and titles itself in the
 * plural, so the sidebar and the page it opened disagreed about what the user
 * was looking at. Each label is the destination's own heading now: a nav item
 * is a promise about where it goes, and "File" opening "All Documents" is a
 * broken one.
 *
 * No exceptions left. Documents used to be one: the page headed itself "All
 * Documents" while the sidebar said "Documents", because in a column of
 * one-word labels that "All" reads as a qualifier distinguishing it from some
 * other documents screen there isn't one of. The pages dropped it instead —
 * every screen that lists files now says Documents, the heading, the tab title
 * and the project-detail section included.
 *
 * No Tasks board. A manager staffs the work and reads it per project; the
 * cross-book task list was this port's own addition and is gone again — tasks
 * are the specialist's screen.
 */
const NAV: NavItem[] = [
  { href: "/manager/customers", label: "Customers", icon: Users },
  { href: "/manager/specialists", label: "Specialists", icon: Wrench },
  { href: "/manager/projects", label: "Projects", icon: FolderKanban },
  { href: "/manager/connect", label: "Connect", icon: MessageSquare },
  { href: "/manager/documents", label: "Documents", icon: FileText },
  { href: "/manager/companies", label: "Companies", icon: Building2 },
  { href: "/manager/profile", label: "Profile", icon: UserRound },
];

/** Accounting manager portal frame. */
export function ManagerShell(
  props: Omit<
    ScopedShellProps,
    "home" | "groupLabel" | "nav" | "profileHref"
  >,
) {
  return (
    <ScopedPortalShell
      {...props}
      home="/manager/projects"
      nav={NAV}
      profileHref="/manager/profile"
    />
  );
}
