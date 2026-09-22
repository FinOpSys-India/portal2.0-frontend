import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { AssignCompanySpecialist } from "@/components/manager/assign-company-specialist";
import {
  companyScope,
  managerApi,
  scoped,
  scopeName,
  type ClientCompany,
} from "@/lib/manager";
import { dateKey, withTeammates } from "@/lib/portal";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Companies" };

/**
 * Companies, narrowed to the header switcher.
 *
 * 1.0 leaves this page unscoped — it is the only cross-company view there —
 * but the switcher scopes the whole portal here, so leaving one page out would
 * make the selection mean something different depending on where you stood.
 * The switcher itself still lists every company, which is how you move between
 * them.
 */
export default async function ManagerCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    size?: string;
    company?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const {
    company: picked,
    page: rawPage,
    size: rawSize,
    sort,
    dir,
    f,
  } = await searchParams;
  const page = parsePage(rawPage);
  const size = parsePageSize(rawSize);
  const company = await companyScope(picked);
  // No specialist roster here any more: the staffing dialog asks the server for
  // its own options when it opens, which spared this page a directory sweep per
  // company on every load.
  const all = await managerApi.companies();

  const scopedRows = company ? all.filter((c) => c.id === company) : all;
  // The column's faces include the customer's own teammates, which no company
  // read carries — one request per row, and this list is one row wide.
  const companies = await withTeammates(scopedRows);

  return (
    <DataTable<ClientCompany>
      title="Companies"
      scope={await scopeName(company)}
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={companies.length}
      rows={companies}
      rowHref={(row) =>
        scoped(`/manager/companies/${encodeURIComponent(row.id)}`, company)
      }
      empty="No companies assigned to you yet."
      columns={[
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
          // Blank until a subscription starts, same as 1.0.
          header: "Billing Date",
          filter: "date",
          sortValue: (row) => dateKey(row.billingDate),
          cell: (row) => (
            <span className="tabular-nums">{row.billingDate ?? ""}</span>
          ),
        },
        {
          header: "Team Members",
          filter: "number",
          sortValue: (row) => row.teamMembers.length,
          cell: (row) => <AvatarStack people={row.teamMembers} />,
        },
        {
          header: "Action",
          // A button per row. Nothing to order by.
          sortValue: false,
          cell: (row) => (
            <AssignCompanySpecialist
              companyId={row.id}
              companyName={row.name}
              assigned={row.specialists}
            />
          ),
        },
      ]}
    />
  );
}
