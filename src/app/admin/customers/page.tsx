import type { Metadata } from "next";

import { ChipsCell, DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { RoleBadge } from "@/components/admin/role-badge";
import { listWindow, adminApi, type Customer } from "@/lib/admin";
import { InviteCustomer } from "./invite-customer";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
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
  const { rows, total } = await adminApi.customers(scan.page, scan.limit);

  return (
    <DataTable<Customer>
      title="Customers"
      page={page}
      sort={sort}
      dir={dir}
      filters={filters}
      total={total}
      action={<InviteCustomer />}
      rows={rows}
      basePath="/admin/customers"
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
          cell: (row) => <ChipsCell items={row.companies} />,
        },
      ]}
    />
  );
}
