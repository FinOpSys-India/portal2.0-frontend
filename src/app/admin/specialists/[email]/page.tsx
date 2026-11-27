import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChipsCell } from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { InitialsAvatar } from "@/components/admin/initials-avatar";
import { StaffActiveSwitch } from "@/components/portal/record-controls";
import { adminApi } from "@/lib/admin";
import { countryLabel } from "@/lib/company";

export const metadata: Metadata = { title: "Specialist" };

/**
 * Specialist detail. Read-only apart from the Active switch the list row
 * carries too: phone and address are the specialist's own, written from
 * their profile.
 */
export default async function SpecialistDetailPage({
  params,
}: {
  params: Promise<{ email: string }>;
}) {
  const { email } = await params;
  const specialist = await adminApi.specialist(decodeURIComponent(email));

  if (!specialist) notFound();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <InitialsAvatar
            name={specialist.name}
            src={specialist.avatarUrl}
            className="size-11 text-sm"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {specialist.name}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {specialist.email}
            </p>
          </div>
        </div>
        {/* No switch until they sign up: the server refuses one (409). */}
        {specialist.invited ? (
          <span className="text-sm text-muted-foreground">Invited</span>
        ) : (
          <StaffActiveSwitch
            userId={specialist.userId}
            name={specialist.name}
            inactive={specialist.inactive}
            manager={false}
          />
        )}
      </div>

      <div className="grid gap-6">
        <DetailSection title="General Information">
          <DetailRow label="Full Name" value={specialist.name} />
          <DetailRow label="Email Address" value={specialist.email} />
          <DetailRow label="Service Specialty" value={specialist.speciality} />
          <DetailRow label="Phone Number" value={specialist.phone} />
          <DetailRow label="Joined" value={specialist.joined} />
          {specialist.specialities.length > 0 && (
            <div>
              <dt className="text-sm text-muted-foreground">Service Lines</dt>
              <dd className="mt-1">
                <ChipsCell items={specialist.specialities} />
              </dd>
            </div>
          )}
          <div>
            <dt className="text-sm text-muted-foreground">
              {specialist.companies.length === 1 ? "Company" : "Companies"}
            </dt>
            <dd className="mt-1">
              <ChipsCell items={specialist.companies} />
            </dd>
          </div>
        </DetailSection>

        <DetailSection title="Address">
          <DetailRow label="Address" value={specialist.addressLine1} />
          <DetailRow label="City" value={specialist.city} />
          <DetailRow label="State" value={specialist.state} />
          <DetailRow label="ZIP Code" value={specialist.zip} />
          <DetailRow label="Country" value={countryLabel(specialist.country)} />
        </DetailSection>
      </div>
    </>
  );
}
