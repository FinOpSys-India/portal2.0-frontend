"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { adminApi } from "@/lib/admin";

export function InviteCustomer() {
  return (
    <InviteDialog
      trigger="Invite customer"
      title="Invite a customer"
      onInvite={adminApi.inviteCustomer}
    />
  );
}
