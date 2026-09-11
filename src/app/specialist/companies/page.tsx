import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { AvatarStack, PersonCell } from "@/components/admin/initials-avatar";
import { type ClientCompany, scoped } from "@/lib/manager";
import { companyScope, scopeName, specialistApi } from "@/lib/specialist";
import { parseFilters } from "@/lib/table-filter";

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
  const [all, manager] = await Promise.all([
    specialistApi.companies(),
    specialistApi.manager(),
  ]);

  const companies = company ? all.filter((c) => c.id === company) : all;

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
        scoped(`/specialist/companies/${encodeURIComponent(row.id)}`, company)
      }
      empty="You are not working for any company yet."
      columns={[
        {
          header: "Company",
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
          filter: "list",
          filterValues: (row) => row.activeServices,
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
      ]}
    />
  );
}
