import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { listWindow, adminApi, type Specialist } from "@/lib/admin";
import { InviteSpecialist } from "./invite-specialist";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Specialists" };

export default async function SpecialistsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const { page: raw, sort, dir, f } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);

  const filters = parseFilters(f);
  // Filtering happens in the table, so it needs more than one page to filter.
  const scan = listWindow(page, filters.length > 0);
  const { rows, total } = await adminApi.specialists(scan.page, scan.limit);

  return (
    <DataTable<Specialist>
      title="Specialists"
      page={page}
      sort={sort}
      dir={dir}
      filters={filters}
      total={total}
      action={<InviteSpecialist />}
      rows={rows}
      basePath="/admin/specialists"
      empty="No specialists yet. Invite one to get started."
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
