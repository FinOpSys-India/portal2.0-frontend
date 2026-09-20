import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { Badge } from "@/components/ui/badge";
import { listWindow, adminApi, type Company, type CompanyStatus } from "@/lib/admin";
import { withTeammates } from "@/lib/portal";
import { AssignManager } from "./assign-manager";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Companies" };

/**
 * The same two chips the portal's project status uses — green for the settled
 * state, amber for the one still in motion — so a colour means one thing across
 * the product.
 */
const STATUS_STYLES: Record<CompanyStatus, string> = {
  Active: "bg-[#dcfce7] text-[#16a34a]",
  Onboarded: "bg-[#fef3c7] text-[#d97706]",
};

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

  /*
   * The Team Members column is the account team plus the customer's own
   * invited colleagues, and only the first half is on the company row.
   *
   * ponytail: one request per row, so ten on a normal page and up to
   * FILTER_SCAN (100) on a filtered one, eight in flight at a time (http.ts).
   * That is the widest fan-out in the portal — the manager's and specialist's
   * versions of this table are scoped to one company. The fix is a teammate
   * count on the company row: `toCompanyAccountRow` already states
   * `teamMemberCount` for the staff, and this column would need nothing else.
   */
  const companies = await withTeammates(rows);

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
      rows={companies}
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
          header: "Status",
          filter: "enum",
          sortValue: (row) => row.status,
          cell: (row) => (
            <Badge
              variant="secondary"
              className={`border-transparent font-medium ${STATUS_STYLES[row.status]}`}
            >
              {row.status}
            </Badge>
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
