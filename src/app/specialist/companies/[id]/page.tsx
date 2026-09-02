import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import {
  AvatarStack,
  InitialsAvatar,
} from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import { specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "Company" };

/**
 * Company — the client's record, read-only.
 *
 * No Current Plans table: the design leaves it out for the specialist
 * (docs/specialist-portal.md), and what a company pays is the manager's
 * business, not the person doing the work.
 *
 * The design's field set here — Display Name, Legal Name, House Number, Street
 * Name, Pin Code — is a different address model from the one the app stores,
 * not a relabel. Ported against the schema that exists.
 */
export default async function SpecialistCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Null covers both "no such company" and "you do not work for it".
  const company = await specialistApi.company(id);
  if (!company) notFound();

  return (
    <>
      <PageHeader title="Company" description={company.name} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <DetailSection title="Company Detail">
            <DetailRow label="Company Name" value={company.name} />
            <DetailRow label="Company Email" value={company.email} />
            <DetailRow label="EN Number" value={company.enNumber} />
            <DetailRow
              label="Active Services"
              value={company.activeServices.join(", ")}
            />
          </DetailSection>

          <DetailSection title="Full Address Information">
            <DetailRow label="Address Line 1" value={company.addressLine1} />
            <DetailRow label="City" value={company.city} />
            <DetailRow label="State" value={company.state} />
            <DetailRow label="ZIP Code" value={company.zip} />
            <DetailRow label="Country" value={company.country} />
          </DetailSection>
        </div>

        <section className="grid gap-4 rounded-xl border border-border bg-card p-6 lg:self-start">
          <div className="flex items-center gap-3">
            <InitialsAvatar name={company.owner} className="size-10" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{company.owner}</p>
              <p className="text-sm text-muted-foreground">Owner</p>
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm text-muted-foreground">Team Members</p>
            <AvatarStack names={company.teamMembers} max={6} />
          </div>
        </section>
      </div>
    </>
  );
}
