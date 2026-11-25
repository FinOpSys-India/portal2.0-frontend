import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { CompanyRowActions } from "@/components/portal/record-controls";
import { NeedsReassignment } from "@/components/portal/reassignment";
import { Badge } from "@/components/ui/badge";
import { listWindow, adminApi, type Company, type CompanyStatus } from "@/lib/admin";
import { dateKey, withTeammates } from "@/lib/portal";
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
  Inactive: "bg-muted text-muted-foreground",
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
      // An inactive company opens nothing, not even for admin: the API refuses
      // its detail read too. Its row's switch and Delete are what's left.
      rowHref={(row) =>
        row.inactive ? undefined : `/admin/companies/${encodeURIComponent(row.id)}`
      }
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
          header: "Next Billing Date",
          filter: "date",
          // M/D/YYYY on screen, which as text puts October before February.
          sortValue: (row) => dateKey(row.billingDate),
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
          // Searched by NAME: the question asked of this column is "which
          // companies is Dana on?", never "which have at least four faces".
          // The cell is an avatar stack, so the names come over separately.
          filter: "text",
          filterValues: (row) => row.teamMembers.map((person) => person.name),
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
           * Admin owns this assignment, replacement included (Sir, Q15; 17
           * Nov): Assign on a company without a manager, Reassign on every
           * company that has one. An Inactive manager keeps their name,
           * marked, with Needs Reassignment until the admin reassigns.
           *
           * FIRST ASSIGNMENT ONLY ON A LIVE COMPANY. `Active` is the paid, subscribed state;
           * everything else — mid-onboarding, lapsed, archived — folds into
           * `Onboarded` (see `toCompany`), and staffing a manager onto an
           * account that may never pay commits a person to work that does not
           * exist. Gated on `Active` rather than on `!== "Onboarded"` so a
           * status added later is closed by default, not open.
           *
           * CLIENT-SIDE ONLY. `PUT /companies/:id/accounting-manager` checks
           * the MANAGER (exists, ACTIVE, holds the role) and not the company's
           * status, so this is the portal's rule and the API will still accept
           * the write from anywhere else.
           */
          cell: (row) => {
            if (!row.accountingManager) {
              return (
                <AssignManager
                  companyId={row.id}
                  companyName={row.name}
                  managers={managers}
                  disabled={row.status !== "Active"}
                />
              );
            }
            const reassign = (
              <AssignManager
                companyId={row.id}
                companyName={row.name}
                managers={managers}
                replacing={row.accountingManager}
                replacingAvatarUrl={row.managerAvatarUrl}
              />
            );
            return row.managerInactive ? (
              <NeedsReassignment>{reassign}</NeedsReassignment>
            ) : (
              reassign
            );
          },
        },
        {
          // Make Inactive / Active and Delete (17 Nov), the admin's alone
          // (25 Nov).
          header: "Actions",
          filter: false,
          sortValue: false,
          cell: (row) => <CompanyRowActions company={row} />,
        },
      ]}
    />
  );
}
