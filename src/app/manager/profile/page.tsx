import type { Metadata } from "next";

import { AvatarUpload } from "@/components/portal/avatar-upload";
import { PageHeader } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { managerApi } from "@/lib/manager";

export const metadata: Metadata = { title: "User Info" };

/**
 * User Info — 1.0's two sections, plus the profile card it puts alongside.
 *
 * EDITABLE, and it saves. 1.0 renders these as inputs with no Save button
 * anywhere on the page (docs/am-portal.md), so an edit is silently discarded;
 * this port renders the same fields and commits them with `PATCH /users/me`.
 * That is the one record — the admin's and the customer's screens read the
 * manager off it too, so what is saved here is what they show.
 */
export default async function ManagerProfilePage() {
  const profile = await managerApi.profile();

  return (
    <>
      <PageHeader title="User Info" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ProfileForm profile={profile} />

        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 lg:self-start">
          {/* Its own write, to its own endpoint — see the note in
              ProfileForm on why it is not inside the form. */}
          <AvatarUpload name={profile.fullName} avatarUrl={profile.avatarUrl} />
          <div className="text-center">
            <p className="font-semibold">{profile.fullName}</p>
            <p className="text-sm text-muted-foreground">Accounting Manager</p>
          </div>
        </section>
      </div>
    </>
  );
}
