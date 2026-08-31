import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable, ListCell } from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { adminApi, type Company } from "@/lib/admin";
import { AssignManager } from "./assign-manager";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  // The assignable managers come back with the rows — same request, so the
  // dropdown cannot list someone the table does not know about.
  const { rows, total, managers } = await adminApi.companies(page);

  return (
    <>
      {/* No create action: companies arrive through customer signup. */}
      <PageHeader title="Companies" />

      <DataTable<Company>
        page={page}
        total={total}
        rows={rows}
        basePath="/admin/companies"
        rowHref={(row) => `/admin/companies/${encodeURIComponent(row.id)}`}
        empty="No companies yet."
        columns={[
          // Columns match 1.0's, including listing team members by name.
          {
            header: "Company Name",
            cell: (row) => <span className="font-medium">{row.name}</span>,
          },
          {
            header: "Company Owner",
            cell: (row) => <PersonCell name={row.owner} />,
          },
          {
            header: "Active Services",
            cell: (row) => <ListCell items={row.activeServices} />,
          },
          {
            header: "Billing Date",
            cell: (row) =>
              row.billingDate ?? (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            header: "Team Members",
            cell: (row) => <AvatarStack names={row.teamMembers} />,
          },
          {
            header: "Accounting Manager",
            /*
             * The one thing admin can write, and it is rendered for EVERY row
             * now — assigned or not. Showing the control only where the cell
             * was empty made the assignment a one-way door: a manager who left
             * the company could not be replaced or removed from here, though
             * both writes existed on the backend all along.
             */
            cell: (row) => (
              <AssignManager
                companyId={row.id}
                managers={managers}
                current={row.accountingManager}
              />
            ),
          },
        ]}
      />
    </>
  );
}
