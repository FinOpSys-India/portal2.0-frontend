import type { Metadata } from "next";

import {
  ChipsCell,
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { RoleBadge } from "@/components/admin/role-badge";
import {
  listWindow,
  adminApi,
  FILTER_SCAN,
  type Customer,
} from "@/lib/admin";
import { InviteCustomer } from "./invite-customer";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
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
  // The company checklist names EVERY company, not only the ones held by the
  // customers on this page — a filter that can only offer what is already on
  // screen is a filter for a list you have already read. One request, in
  // parallel with the rows.
  const [{ rows, total }, companies] = await Promise.all([
    adminApi.customers(scan.page, scan.limit),
    adminApi.companies(1, FILTER_SCAN),
  ]);

  return (
    <DataTable<Customer>
      title="Customers"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={filters}
      total={total}
      action={<InviteCustomer />}
      rows={rows}
      rowHref={(row) => `/admin/customers/${encodeURIComponent(row.email)}`}
      empty="No customers yet. Invite one to get started."
      columns={[
        {
          header: "Name",
          sortValue: (row) => row.name,
          cell: (row) => <PersonCell name={row.name} />,
        },
        {
          header: "Role",
          filter: "enum",
          sortValue: (row) => row.role,
          // Muted throughout: role is a label, not a status worth shouting.
          // Owner keeps a faint brand tint so the two stay distinguishable.
          cell: (row) => <RoleBadge role={row.role} />,
        },
        {
          header: "Email",
          cell: (row) => (
            <span className="text-muted-foreground">{row.email}</span>
          ),
        },
        {
          // Plural, and one chip each: a customer can belong to several
          // companies, and they are separate records rather than one name.
          header: "Companies",
          sortValue: (row) => row.companies.join(", "),
          filter: "list",
          filterValues: (row) => row.companies,
          filterOptions: companies.rows.map((company) => company.name),
          cell: (row) => <ChipsCell items={row.companies} />,
        },
      ]}
    />
  );
}
