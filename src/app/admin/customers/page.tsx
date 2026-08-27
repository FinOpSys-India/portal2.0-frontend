import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { ChipsCell, DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { RoleBadge } from "@/components/admin/role-badge";
import { adminApi, type Customer } from "@/lib/admin";
import { InviteCustomer } from "./invite-customer";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: raw } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  const { rows, total } = await adminApi.customers(page);

  return (
    <>
      <PageHeader title="Customers" action={<InviteCustomer />} />

      <DataTable<Customer>
        page={page}
        total={total}
        rows={rows}
        basePath="/admin/customers"
        rowHref={(row) => `/admin/customers/${encodeURIComponent(row.email)}`}
        empty="No customers yet. Invite one to get started."
        columns={[
          { header: "Name", cell: (row) => <PersonCell name={row.name} /> },
          {
            header: "Role",
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
            cell: (row) => <ChipsCell items={row.companies} />,
          },
        ]}
      />
    </>
  );
}
