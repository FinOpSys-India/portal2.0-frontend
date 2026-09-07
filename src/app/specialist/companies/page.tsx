import type { Metadata } from "next";

import { DataTable, ListCell } from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import { type ClientCompany, scoped } from "@/lib/manager";
import { companyScope, scopeName, specialistApi } from "@/lib/specialist";

export const metadata: Metadata = { title: "Companies" };

/**
 * Companies — the ones this specialist is working for, which is to say the
 * ones they hold a project on. Read-only: the design gives the specialist no
 * action column, where the manager's version of this table has Assign
 * Specialist on every row.
 */
export default async function SpecialistCompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; sort?: string; dir?: string }>;
}) {
  const { company: picked, sort, dir } = await searchParams;
  const company = await companyScope(picked);
  const [all, manager] = await Promise.all([
    specialistApi.companies(),
    specialistApi.manager(),
  ]);

  const companies = company ? all.filter((c) => c.id === company) : all;

  return (
    <>
      <PageHeader title="Companies" scope={await scopeName(company)} />

      <DataTable<ClientCompany>
        page={1}
        sort={sort}
        dir={dir}
        total={companies.length}
        rows={companies}
        basePath="/specialist/companies"
        rowHref={(row) =>
          scoped(`/specialist/companies/${encodeURIComponent(row.id)}`, company)
        }
        empty="You are not working for any company yet."
        columns={[
          {
            header: "Company",
            cell: (row) => <span className="font-medium">{row.name}</span>,
          },
          {
            header: "Company Owner",
            sortValue: (row) => row.owner,
            cell: (row) => <PersonCell name={row.owner} />,
          },
          {
            // The design's fifth column. One manager routes all of this
            // specialist's work, so the value is the same on every row — kept
            // because the design shows it and it names who to ask.
            header: "Accounting Manager",
            // The same manager on every row, so sorting by it is a no-op —
            // left sortable only because a header that behaves differently
            // from its neighbours reads as broken.
            sortValue: () => manager.name,
            cell: () => <PersonCell name={manager.name} />,
          },
          {
            header: "Active Services",
            sortValue: (row) => row.activeServices.join(", "),
            cell: (row) => <ListCell items={row.activeServices} />,
          },
          {
            // Blank until a subscription starts, same as 1.0.
            header: "Billing Date",
            sortValue: (row) => Date.parse(row.billingDate ?? "") || 0,
            cell: (row) => (
              <span className="tabular-nums">{row.billingDate ?? ""}</span>
            ),
          },
          {
            header: "Team Members",
            sortValue: (row) => row.teamMembers.length,
            cell: (row) => <AvatarStack names={row.teamMembers} />,
          },
        ]}
      />
    </>
  );
}
