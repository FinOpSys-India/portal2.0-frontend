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
 * Documents is the one item shortened rather than matched: the page heads
 * itself "All Documents", but in a column of one-word labels the "All" reads as
 * a qualifier distinguishing it from some other documents screen there isn't
 * one of. Same rule, applied to the sidebar's own line width.
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
  { href: "/manager/profile", label: "User Info", icon: UserRound },
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
