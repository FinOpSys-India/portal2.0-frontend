import type { Metadata } from "next";

import {
  ChipsCell,
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import {
  listWindow,
  adminApi,
  FILTER_SCAN,
  type AccountingManager,
} from "@/lib/admin";
import { InviteManager } from "./invite-manager";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Accounting Managers" };

export default async function AccountingManagersPage({
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
  // Every company, not only those already assigned to a manager on this page —
  // the point of the checklist is to find who has one you are looking for.
  const [{ rows, total }, companies] = await Promise.all([
    adminApi.accountingManagers(scan.page, scan.limit),
    adminApi.companies(1, FILTER_SCAN),
  ]);

  // No detail view: 1.0 has none, and there is nothing here a detail
  // page would show that the row does not.
  return (
    <DataTable<AccountingManager>
      title="Accounting Managers"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={filters}
      total={total}
      action={<InviteManager />}
      rows={rows}
      empty="No accounting managers yet."
      columns={[
        {
          header: "Name",
          sortValue: (row) => row.name,
          cell: (row) => <PersonCell name={row.name} />,
        },
        {
          header: "Assigned Companies",
          sortValue: (row) => row.companies.join(", "),
          filter: "list",
          filterValues: (row) => row.companies,
          filterOptions: companies.rows.map((company) => company.name),
          cell: (row) => <ChipsCell items={row.companies} />,
        },
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
