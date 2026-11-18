import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle } from "lucide-react";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AvatarStack } from "@/components/admin/initials-avatar";
import {
  CompanyActiveSwitch,
  DeleteCompany,
} from "@/components/portal/record-controls";
import { PageHeader } from "@/components/portal/portal-shell";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { api, unpaidCompanyIds } from "@/lib/api";
import { customerApi } from "@/lib/customer";
import { countryLabel, formatEin } from "@/lib/company";
import { mustPayToReactivate } from "@/lib/portal";

export const metadata: Metadata = { title: "Company" };

/**
 * Company Details, read-only — the row the customer clicks on the Company
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
  params: Promise<{ workspace: string; id: string }>;
}) {
  const { workspace, id } = await params;

  // NOT narrowed to the workspace in the path: the Company table lists every
  // company this customer reaches, not just the open one, so a row for the
  // second company has to open from the first company's frame. Who may read
  // which company is the service's own per-company check — a company that is
  // not theirs is a 403 there, never a page.
  //
  // Owned fails closed, as in the layout: a teammate gets no switch and no
  // Delete, which is what the server would hold them to anyway.
  const [company, status, owned] = await Promise.all([
    customerApi.company(id),
    api.onboardingStatus(),
    api.ownedCompanies().catch(() => []),
  ]);
  if (!company) notFound();
  const owner = owned.some((c) => String(c.companyId) === id);

  /*
   * The Company table sends an unpaid row to its plan step, so this page is
   * reached for one only by a typed URL, a bookmark, or a link from before the
   * bill. Saying so beats a panel of fields that look like a live account —
   * Active Services and Next Billing Date are both blank on a company that was
   * never activated, which reads as missing data rather than an unpaid bill.
   */
  const owes = unpaidCompanyIds(status).includes(id);

  return (
    <>
      <PageHeader
        title="Company Details"
        description={company.name}
        action={
          owner ? (
            <span className="flex flex-wrap items-center gap-4">
              <CompanyActiveSwitch
                companyId={id}
                name={company.name}
                inactive={company.inactive}
                mustPay={mustPayToReactivate(company.paidUntil, owes)}
              />
              <DeleteCompany
                companyId={id}
                name={company.name}
                // Deleting the company you are standing in takes the frame
                // with it, so go back through the picker.
                after={
                  id === workspace
                    ? "/company_select"
                    : `/customer/${encodeURIComponent(workspace)}/company`
                }
              />
            </span>
          ) : undefined
        }
      />

      <div className="grid gap-6">
        {owes && (
          <Alert variant="destructive" className="items-start">
            <AlertCircle className="size-4" aria-hidden />
            <AlertDescription>
              Payment for this company is pending, so it is not active yet.{" "}
              <Link
                href={`/on_boarding_form_part_2?compID=${encodeURIComponent(id)}`}
              >
                Complete payment
              </Link>{" "}
              to start using it.
            </AlertDescription>
          </Alert>
        )}

        <DetailSection title="General Information">
          <DetailRow label="Company Name" value={company.name} />
          <DetailRow label="Company Email" value={company.email} />
          <DetailRow label="EIN" value={formatEin(company.enNumber)} />
          <DetailRow
            label="Active Services"
            value={company.activeServices.join(", ")}
          />
          <DetailRow label="Next Billing Date" value={company.billingDate} />
        </DetailSection>

        <DetailSection title="Address">
          <DetailRow label="Address" value={company.addressLine1} />
          <DetailRow label="City" value={company.city} />
          <DetailRow label="State" value={company.state} />
          <DetailRow label="ZIP Code" value={company.zip} />
          <DetailRow label="Country" value={countryLabel(company.country)} />
        </DetailSection>

        <section className="rounded-xl border border-border bg-card p-6">
          <p className="mb-3 text-sm text-muted-foreground">Team Members</p>
          <AvatarStack people={company.teamMembers} max={6} />
        </section>
      </div>
    </>
  );
}
