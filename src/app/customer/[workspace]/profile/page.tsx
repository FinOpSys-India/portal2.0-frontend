import type { Metadata } from "next";

import { AvatarUpload } from "@/components/portal/avatar-upload";
import { PageHeader } from "@/components/portal/portal-shell";
import { ProfileForm } from "@/components/portal/profile-form";
import { customerApi } from "@/lib/customer";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await customerApi.profile();

  return (
    <>
      <PageHeader title="Profile" />

      <div className="max-w-2xl space-y-6">
        {/*
         * Outside the form, deliberately. The picture is its own write — its
         * own endpoint, its own result — and putting it inside would make Save
         * look like what commits it, so a user who picked a photo and did not
         * press Save would think they had lost it.
         */}
        <section className="flex items-center gap-5 rounded-xl border border-border bg-card p-6">
          <AvatarUpload name={profile.fullName} avatarUrl={profile.avatarUrl} />
          <div>
            <p className="font-semibold">{profile.fullName}</p>
            <p className="text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </section>

        <ProfileForm profile={profile} />
      </div>
    </>
  );
}
