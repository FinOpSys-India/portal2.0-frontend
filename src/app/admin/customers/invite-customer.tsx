"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { adminApi } from "@/lib/admin";

export function InviteCustomer() {
  return (
    <InviteDialog
      trigger="Invite Customer"
      title="Invite a Customer"
      onInvite={adminApi.inviteCustomer}
    />
  );
}
