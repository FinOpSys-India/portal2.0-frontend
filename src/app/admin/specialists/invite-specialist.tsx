"use client";

import { InviteDialog } from "@/components/admin/invite-dialog";
import { SPECIALIST_ROLES, adminApi } from "@/lib/admin";

export function InviteSpecialist() {
  return (
    <InviteDialog
      trigger="Invite Specialist"
      title="Invite a Specialist"
      roles={SPECIALIST_ROLES}
      onInvite={adminApi.inviteSpecialist}
    />
  );
}
