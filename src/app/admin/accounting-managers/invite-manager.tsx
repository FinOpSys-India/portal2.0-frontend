"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { adminApi } from "@/lib/admin";

export function InviteManager() {
  return (
    <InviteDialog
      trigger="Invite manager"
      title="Invite an accounting manager"
      emailLabel="FinOpSys Email Address"
      onInvite={adminApi.inviteAccountingManager}
    />
  );
}
