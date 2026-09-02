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
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
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
            cell: (row) => <PersonCell name={row.owner} />,
          },
          {
            // The design's fifth column. One manager routes all of this
            // specialist's work, so the value is the same on every row — kept
            // because the design shows it and it names who to ask.
            header: "Accounting Manager",
            cell: () => <PersonCell name={manager.name} />,
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
        ]}
      />
    </>
  );
}
