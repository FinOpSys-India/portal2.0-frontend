import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/portal/portal-shell";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AvatarStack } from "@/components/admin/initials-avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminApi } from "@/lib/admin";

export const metadata: Metadata = { title: "Company" };

/**
 * Company detail. Read-only: the customer owns this data.
 *
 * 1.0 renders the address fields as `disabled` inputs pre-filled with sample
 * text (1234 Elm Street, Springfield, IL) that looks like real data but is
 * placeholder. Shown here as plain values, so empty reads as empty.
 */
export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await adminApi.company(decodeURIComponent(id));

  if (!company) notFound();

  return (
    <>
      <PageHeader title={company.name} description={company.email} />

      <div className="grid gap-6">
        <DetailSection title="Basic details">
          <DetailRow label="Company name" value={company.name} />
          <DetailRow label="Company email" value={company.email} />
          <DetailRow label="EN number" value={company.enNumber} />
          <DetailRow label="Owner" value={company.owner} />
          <DetailRow
            label="Accounting manager"
            value={company.accountingManager}
          />
          <DetailRow label="Billing date" value={company.billingDate} />
        </DetailSection>

        <DetailSection title="Address">
          <DetailRow label="Address line 1" value={company.addressLine1} />
          <DetailRow label="City" value={company.city} />
          <DetailRow label="State" value={company.state} />
          <DetailRow label="ZIP code" value={company.zip} />
          <DetailRow label="Country" value={company.country} />
        </DetailSection>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">Current plans</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Service</TableHead>
                  <TableHead>Current plan</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.plans.map((plan) => (
                  <TableRow key={plan.service}>
                    <TableCell className="font-medium">
                      {plan.service}
                    </TableCell>
                    <TableCell>{plan.plan}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {plan.amount}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <span className="text-sm text-muted-foreground">Team members</span>
            <AvatarStack names={company.teamMembers} max={6} />
          </div>
        </section>
      </div>
    </>
  );
}
