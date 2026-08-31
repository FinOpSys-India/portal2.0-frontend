import type { Metadata } from "next";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AvatarUpload } from "@/components/portal/avatar-upload";
import { PageHeader } from "@/components/portal/portal-shell";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "User Info" };

/**
 * User Information — the same two sections and profile card every portal shows.
 *
 * Read-only. 1.0 renders these as editable inputs with no Save button anywhere
 * on the page, so an edit either autosaves on blur or is silently discarded —
 * see docs/am-portal.md. Values until that is settled: a form that may quietly
 * drop what you typed is worse than a record.
 */
export default async function SpecialistProfilePage() {
  const profile = await specialistApi.profile();

  return (
    <>
      <PageHeader title="User Information" />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <DetailSection title="User Information">
            <DetailRow label="Full Name" value={profile.name} />
            <DetailRow label="Email Address" value={profile.email} />
            <DetailRow label="Phone Number" value={profile.phone} />
            <DetailRow label="Job Role" value={profile.speciality} />
          </DetailSection>

          {/* The captured record stores one address line rather than the
              design's House Number / Street Name / Pin Code split. Shown as
              stored — the split is a schema change, not a relabel. */}
          <DetailSection title="Full Address Information">
            <DetailRow label="Address" value={profile.address} />
          </DetailSection>
        </div>

        <section className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 lg:self-start">
          <AvatarUpload
            name={profile.name}
            avatarUrl={profile.avatarUrl ?? null}
          />
          <div className="text-center">
            <p className="font-semibold">{profile.name}</p>
            <p className="text-sm text-muted-foreground">
              {profile.speciality}
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
