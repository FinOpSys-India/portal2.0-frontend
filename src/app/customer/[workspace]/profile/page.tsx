import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { customerApi } from "@/lib/customer";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await customerApi.profile();

  return (
    <>
      <PageHeader title="Profile" />
      <ProfileForm profile={profile} />
    </>
  );
}
