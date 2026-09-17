import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AvatarStack } from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import { customerApi } from "@/lib/customer";

export const metadata: Metadata = { title: "Company" };

/**
 * Company Information, read-only — the row the customer clicks on the Company
 * table, which had nowhere to go until now.
 *
 * Same field set the staff portals show (docs/functionality-matrix.md), minus
 * Current Plans: the detail route carries no prices, and what this company pays
 * is already a screen of its own at /billing, priced from the subscription.
 *
 * Read-only despite the customer owning these fields. 1.0's version of this
 * screen has editable inputs and no Save button — an edit there either
 * autosaves on blur or is silently discarded (docs/customer-portal.md) — and a
 * field with nowhere to commit is worse than a value.
 */
export default async function CustomerCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // NOT narrowed to the workspace in the path: the Company table lists every
  // company this customer reaches, not just the open one, so a row for the
  // second company has to open from the first company's frame. Who may read
  // which company is the service's own per-company check — a company that is
  // not theirs is a 403 there, never a page.
  const company = await customerApi.company(id);
  if (!company) notFound();

  return (
    <>
      <PageHeader title="Company Information" description={company.name} />

      <div className="grid gap-6">
        <DetailSection title="Basic Details">
          <DetailRow label="Company Name" value={company.name} />
          <DetailRow label="Company Email" value={company.email} />
          <DetailRow label="EN Number" value={company.enNumber} />
          <DetailRow
            label="Active Services"
            value={company.activeServices.join(", ")}
          />
          <DetailRow label="Subscription Date" value={company.billingDate} />
        </DetailSection>

        <DetailSection title="Full Address Information">
          <DetailRow label="Address Line 1" value={company.addressLine1} />
          <DetailRow label="City" value={company.city} />
          <DetailRow label="State" value={company.state} />
          <DetailRow label="ZIP Code" value={company.zip} />
          <DetailRow label="Country" value={company.country} />
        </DetailSection>

        <section className="rounded-xl border border-border bg-card p-6">
          <p className="mb-3 text-sm text-muted-foreground">Team Members</p>
          <AvatarStack people={company.teamMembers} max={6} />
        </section>
      </div>
    </>
  );
}
