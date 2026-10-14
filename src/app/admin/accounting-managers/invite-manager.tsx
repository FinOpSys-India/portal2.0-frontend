"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { adminApi } from "@/lib/admin";

export function InviteManager() {
  return (
    <InviteDialog
      trigger="Invite Accounting Manager"
      title="Invite an Accounting Manager"
      staff
      onInvite={adminApi.inviteAccountingManager}
    />
  );
}
