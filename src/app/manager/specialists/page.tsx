import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import {
  companyScope,
  managerApi,
  scopeName,
  type Specialist,
} from "@/lib/manager";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Specialists" };

/**
 * Specialists, read-only — 1.0's three columns exactly.
 *
 * Same route admin uses, rendered without the create action: a manager routes
 * work to specialists but cannot invite or remove them.
 *
 * Scoped by the header switcher through project assignment, since a specialist
 * belongs to no company directly.
 */
export default async function ManagerSpecialistsPage({
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
  const specialists = await managerApi.specialists(company);

  return (
    <DataTable<Specialist>
      title="Specialists"
      scope={await scopeName(company)}
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={specialists.length}
      rows={specialists}
      rowHref={(row) => `/manager/specialists/${encodeURIComponent(row.email)}`}
      empty={
        company
          ? "Nobody is working a project for this company yet."
          : "No specialists yet."
      }
      columns={[
        {
          header: "Name",
          sortValue: (row) => row.name,
          cell: (row) => <PersonCell name={row.name} />,
        },
        { header: "Service Speciality", cell: (row) => row.speciality },
        {
          header: "Email",
          cell: (row) => (
            <span className="text-muted-foreground">{row.email}</span>
          ),
        },
      ]}
    />
  );
}
