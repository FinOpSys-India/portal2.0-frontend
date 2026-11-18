import type { Metadata } from "next";

import { AdminShell } from "@/components/admin/admin-shell";
import { NotificationBell } from "@/components/portal/portal-chrome";
import { ReassignNotice } from "@/components/portal/reassignment";
import { adminApi } from "@/lib/admin";
import { reassignmentNotifications } from "@/lib/portal";

export const metadata: Metadata = {
  title: { default: "Admin – FinOpSys", template: "%s – Admin – FinOpSys" },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Companies whose accounting manager was made Inactive (17 Nov). Swallowed:
  // a frame that fails over a reminder is worse than one without it.
  const pending = await adminApi.reassignments().catch(() => []);

  return (
    <AdminShell
      notifications={
        <NotificationBell
          items={reassignmentNotifications(pending, "/admin/companies/")}
        />
      }
    >
      <ReassignNotice
        title="Reassign Accounting Managers"
        description="These companies’ accounting manager is inactive. Assign each one a new accounting manager."
        items={pending}
        hrefBase="/admin/companies/"
      />
      {children}
    </AdminShell>
  );
}
