"use client";

import { Building2, UserCog, Users, Wrench } from "lucide-react";

import { PortalShell, type NavItem } from "@/components/portal/portal-shell";

/**
 * Admin navigation.
 *
 * 1.0 labels the third item "Coordinator" while its route and page heading
 * both say "Accounting Manager". That inconsistency is not reproduced — one
 * name is used everywhere, and it is the one the rest of the product uses.
 */
const NAV: NavItem[] = [
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/specialists", label: "Specialists", icon: Wrench },
  {
    href: "/admin/accounting-managers",
    label: "Accounting Managers",
    icon: UserCog,
  },
  { href: "/admin/companies", label: "Companies", icon: Building2 },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <PortalShell home="/admin/customers" nav={NAV}>
      {children}
    </PortalShell>
  );
}
