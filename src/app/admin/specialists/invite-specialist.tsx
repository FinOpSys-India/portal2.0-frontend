"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { SPECIALIST_ROLES, adminApi } from "@/lib/admin";

export function InviteSpecialist() {
  return (
    <InviteDialog
      trigger="Invite specialist"
      title="Invite a specialist"
      roles={SPECIALIST_ROLES}
      onInvite={adminApi.inviteSpecialist}
    />
  );
}
