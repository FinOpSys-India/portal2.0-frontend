import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AvatarStack } from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { managerApi } from "@/lib/manager";

export const metadata: Metadata = { title: "Company" };

/**
 * Company Information — Basic Details, Full Address, Current Plans, in 1.0's
 * order (am-09-company-detail.png).
 *
 * EN Number is the one field a manager can write in 1.0, and 1.0 gives it no
 * Save button, so an edit either autosaves on blur or is silently discarded.
 * Read-only here until that is settled: an input with nowhere to commit is
 * worse than a value.
 */
export default async function ManagerCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const company = await managerApi.company(id);

  if (!company) notFound();

  return (
    <>
      <PageHeader title="Company Information" description={company.name} />

      <div className="grid gap-6">
        <DetailSection title="Basic Details">
          <DetailRow label="Company Name" value={company.name} />
          <DetailRow label="Company Email" value={company.email} />
          <DetailRow label="EN Number" value={company.enNumber} />
        </DetailSection>

        <DetailSection title="Full Address Information">
          <DetailRow label="Address Line 1" value={company.addressLine1} />
          <DetailRow label="City" value={company.city} />
          <DetailRow label="State" value={company.state} />
          <DetailRow label="ZIP Code" value={company.zip} />
          <DetailRow label="Country" value={company.country} />
        </DetailSection>

        <section className="rounded-xl border border-border bg-card p-6">
          <h2 className="mb-4 text-sm font-semibold">Current Plans</h2>
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Service</TableHead>
                  <TableHead>Current Plan</TableHead>
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
            <span className="text-sm text-muted-foreground">Team Members</span>
            <AvatarStack names={company.teamMembers} max={6} />
          </div>
        </section>
      </div>
    </>
  );
}
