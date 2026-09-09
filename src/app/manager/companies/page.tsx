import type { Metadata } from "next";

import { DataTable, ListCell } from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { AssignCompanySpecialist } from "@/components/manager/assign-company-specialist";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  type ClientCompany,
  companyScope,
  managerApi,
  scopeName,
} from "@/lib/manager";
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
    company?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const { company: picked, sort, dir, f } = await searchParams;
  const company = await companyScope(picked);
  // No specialist roster here any more: the staffing dialog asks the server for
  // its own options when it opens, which spared this page a directory sweep per
  // company on every load.
  const all = await managerApi.companies();

  const companies = company ? all.filter((c) => c.id === company) : all;

  return (
    <>
      <PageHeader title="Companies" scope={await scopeName(company)} />

      <DataTable<ClientCompany>
        page={1}
        sort={sort}
        dir={dir}
        filters={parseFilters(f)}
        total={companies.length}
        rows={companies}
        basePath="/manager/companies"
        rowHref={(row) => `/manager/companies/${encodeURIComponent(row.id)}`}
        empty="No companies assigned to you yet."
        columns={[
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
            // Blank until a subscription starts, same as 1.0.
            header: "Billing Date",
            filter: "date",
            sortValue: (row) => Date.parse(row.billingDate ?? "") || 0,
            cell: (row) => (
              <span className="tabular-nums">{row.billingDate ?? ""}</span>
            ),
          },
          {
            header: "Team Members",
            filter: "number",
            sortValue: (row) => row.teamMembers.length,
            cell: (row) => <AvatarStack names={row.teamMembers} />,
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
    </>
  );
}
