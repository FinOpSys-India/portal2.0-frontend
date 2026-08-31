import type { Metadata } from "next";

import { AvatarUpload } from "@/components/portal/avatar-upload";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PageHeader } from "@/components/portal/portal-shell";
import { managerApi } from "@/lib/manager";

export const metadata: Metadata = { title: "User Info" };

/**
 * User Info — 1.0's two sections, plus the profile card it puts alongside.
 *
 * Read-only. 1.0 renders these as editable inputs with **no Save button
 * anywhere on the page**, so an edit either autosaves on blur or is silently
 * discarded — see docs/am-portal.md. Values until that is settled: a form that
 * may quietly drop what you typed is worse than a record.
 */
export default async function ManagerProfilePage() {
  const profile = await managerApi.profile();

  return (
    <>
      <PageHeader title="User Info" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <DetailSection title="General Information">
            <DetailRow label="Full Name" value={profile.name} />
            <DetailRow label="Email Address" value={profile.email} />
            <DetailRow label="Phone Number" value={profile.phone} />
          </DetailSection>

          {/* Empty for staff accounts in the captured data — rendered anyway,
              because a missing row reads as a missing field. */}
          <DetailSection title="Full Address Information">
            <DetailRow label="Address Line 1" value="" />
            <DetailRow label="City" value="" />
            <DetailRow label="State" value="" />
            <DetailRow label="ZIP Code" value="" />
            <DetailRow label="Country" value="United States of America" />
          </DetailSection>
        </div>

        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 lg:self-start">
          {/* The one field on this page that IS editable. The rest are values
              until 1.0's save-less form is settled; a picture has no such
              ambiguity — the endpoint takes it and reports the result. */}
          <AvatarUpload name={profile.name} avatarUrl={profile.avatarUrl} />
          <div className="text-center">
            <p className="font-semibold">{profile.name}</p>
            <p className="text-sm text-muted-foreground">Accounting Manager</p>
          </div>
        </section>
      </div>
    </>
  );
}
