import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/portal/portal-shell";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AvatarStack } from "@/components/admin/initials-avatar";
import {
  SortableHeadRow,
  sortRows,
  type SortableColumn,
} from "@/components/admin/data-table";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { adminApi, type CompanyPlan } from "@/lib/admin";

const PLAN_COLUMNS: SortableColumn<CompanyPlan>[] = [
  { header: "Service", sortValue: (plan) => plan.service },
  { header: "Current Plan", sortValue: (plan) => plan.plan ?? "" },
  {
    header: "Amount",
    className: "text-right",
    // "$1,200" — text order puts $99 above $1,200.
    sortValue: (plan) => Number(plan.amount.replace(/[^0-9.]/g, "")) || 0,
  },
];

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const [{ id }, { sort, dir }] = await Promise.all([params, searchParams]);
  const company = await adminApi.company(decodeURIComponent(id));

  if (!company) notFound();

  return (
    <>
      <PageHeader title={company.name} description={company.email} />

      <div className="grid gap-6">
        <DetailSection title="Basic Details">
          <DetailRow label="Company Name" value={company.name} />
          <DetailRow label="Company Email" value={company.email} />
          <DetailRow label="EN Number" value={company.enNumber} />
          <DetailRow label="Owner" value={company.owner} />
          <DetailRow
            label="Accounting Manager"
            value={company.accountingManager}
          />
          <DetailRow label="Billing Date" value={company.billingDate} />
        </DetailSection>

        <DetailSection title="Address">
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
              <SortableHeadRow columns={PLAN_COLUMNS} sort={sort} dir={dir} />
              <TableBody>
                {sortRows(company.plans, PLAN_COLUMNS, sort, dir).map(
                  (plan) => (
                    <TableRow key={plan.service}>
                      <TableCell className="font-medium">
                        {plan.service}
                      </TableCell>
                      <TableCell>{plan.plan}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {plan.amount}
                      </TableCell>
                    </TableRow>
                  ),
                )}
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
