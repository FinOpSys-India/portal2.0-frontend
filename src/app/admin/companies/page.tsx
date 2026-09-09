import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable, ListCell } from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { listWindow, adminApi, type Company } from "@/lib/admin";
import { AssignManager } from "./assign-manager";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Companies" };

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const { page: raw, sort, dir, f } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);

  const filters = parseFilters(f);
  // Filtering happens in the table, so it needs more than one page to filter.
  const scan = listWindow(page, filters.length > 0);
  // The assignable managers come back with the rows — same request, so the
  // dropdown cannot list someone the table does not know about.
  const { rows, total, managers } = await adminApi.companies(
    scan.page,
    scan.limit,
  );

  return (
    <>
      {/* No create action: companies arrive through customer signup. */}
      <PageHeader title="Companies" />

      <DataTable<Company>
        page={page}
        sort={sort}
        dir={dir}
        filters={filters}
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
            sortValue: (row) => row.owner,
            cell: (row) => <PersonCell name={row.owner} />,
          },
          {
            header: "Active Services",
            sortValue: (row) => row.activeServices.join(", "),
            cell: (row) => <ListCell items={row.activeServices} />,
          },
          {
            header: "Billing Date",
            filter: "date",
            // M/D/YYYY on screen, which as text puts October before February.
            sortValue: (row) => Date.parse(row.billingDate ?? "") || 0,
            cell: (row) =>
              row.billingDate ?? (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            header: "Team Members",
            filter: "number",
            // Faces carry no text to sort — how many there are is the one thing
            // the column says that can be ordered.
            sortValue: (row) => row.teamMembers.length,
            cell: (row) => <AvatarStack names={row.teamMembers} />,
          },
          {
            header: "Accounting Manager",
            filter: "enum",
            sortValue: (row) => row.accountingManager ?? "",
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
