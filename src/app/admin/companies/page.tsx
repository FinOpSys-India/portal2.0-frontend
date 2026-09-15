import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
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
    size?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const { page: raw, size: rawSize, sort, dir, f } = await searchParams;
  const page = parsePage(raw);
  const size = parsePageSize(rawSize);

  const filters = parseFilters(f);
  // Filtering happens in the table, so it needs more than one page to filter.
  const scan = listWindow(page, filters.length > 0, size);
  // The assignable managers come back with the rows — same request, so the
  // dropdown cannot list someone the table does not know about.
  const { rows, total, managers } = await adminApi.companies(
    scan.page,
    scan.limit,
  );

  // No create action: companies arrive through customer signup.
  return (
    <DataTable<Company>
      title="Companies"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={filters}
      total={total}
      rows={rows}
      rowHref={(row) => `/admin/companies/${encodeURIComponent(row.id)}`}
      empty="No companies yet."
      columns={[
        // Columns match 1.0's, including listing team members by name.
        {
          header: "Company Name",
          // A checklist, like every other place a list is narrowed by company:
          // picking three companies is one filter, where Contains can only ask
          // about one spelling at a time.
          filter: "enum",
          sortValue: (row) => row.name,
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        {
          header: "Company Owner",
          sortValue: (row) => row.owner,
          cell: (row) => <PersonCell name={row.owner} avatarUrl={row.ownerAvatarUrl} />,
        },
        {
          header: "Active Services",
          sortValue: (row) => row.activeServices.join(", "),
          filter: "list",
          filterValues: (row) => row.activeServices,
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
          cell: (row) => <AvatarStack people={row.teamMembers} />,
        },
        {
          header: "Accounting Manager",
          filter: "enum",
          sortValue: (row) => row.accountingManager ?? "",
          /*
           * Assignment is a one-way door: the control shows only where a
           * company has no manager yet. Once one is set the cell is plain
           * text — no change, no removal from this screen.
           */
          cell: (row) =>
            row.accountingManager ?? (
              <AssignManager companyId={row.id} managers={managers} />
            ),
        },
      ]}
    />
  );
}
