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
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
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
            cell: (row) => <PersonCell name={row.owner} />,
          },
          {
            header: "Active Services",
            cell: (row) => <ListCell items={row.activeServices} />,
          },
          {
            // Blank until a subscription starts, same as 1.0.
            header: "Billing Date",
            cell: (row) => (
              <span className="tabular-nums">{row.billingDate ?? ""}</span>
            ),
          },
          {
            header: "Team Members",
            cell: (row) => <AvatarStack names={row.teamMembers} />,
          },
          {
            header: "Action",
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
