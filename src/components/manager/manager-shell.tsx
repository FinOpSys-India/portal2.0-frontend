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

/** Seven items, in 1.0's order and with 1.0's labels. */
const NAV: NavItem[] = [
  { href: "/manager/customers", label: "Customer", icon: Users },
  { href: "/manager/specialists", label: "Specialist", icon: Wrench },
  { href: "/manager/projects", label: "Project", icon: FolderKanban },
  { href: "/manager/connect", label: "Connect", icon: MessageSquare },
  { href: "/manager/documents", label: "File", icon: FileText },
  { href: "/manager/companies", label: "Company", icon: Building2 },
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
