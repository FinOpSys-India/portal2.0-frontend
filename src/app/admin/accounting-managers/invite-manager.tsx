"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { adminApi } from "@/lib/admin";

export function InviteManager() {
  return (
    <InviteDialog
      trigger="Invite Manager"
      title="Invite an Accounting Manager"
      emailLabel="FinOpSys Email Address"
      onInvite={adminApi.inviteAccountingManager}
    />
  );
}
