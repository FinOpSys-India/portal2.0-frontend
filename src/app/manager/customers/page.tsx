import type { Metadata } from "next";

import { ChipsCell, DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { RoleBadge } from "@/components/admin/role-badge";
import { PageHeader } from "@/components/portal/portal-shell";
import {
  companyScope,
  managerApi,
  type ManagerCustomer,
  scopeName,
} from "@/lib/manager";

export const metadata: Metadata = { title: "Customers" };

/**
 * Customers of the manager's companies, read-only.
 *
 * Same route admin uses in 1.0, rendered without the create action: a manager
 * cannot invite a customer, only read the ones already on their companies.
 */
export default async function ManagerCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
  const customers = await managerApi.customers(company);

  return (
    <>
      <PageHeader title="Customers" scope={await scopeName(company)} />

      <DataTable<ManagerCustomer>
        page={1}
        total={customers.length}
        rows={customers}
        basePath="/manager/customers"
        rowHref={(row) => `/manager/customers/${encodeURIComponent(row.email)}`}
        empty="No customers on this company yet."
        columns={[
          { header: "Name", cell: (row) => <PersonCell name={row.name} /> },
          { header: "Role", cell: (row) => <RoleBadge role={row.role} /> },
          {
            header: "Email",
            cell: (row) => (
              <span className="text-muted-foreground">{row.email}</span>
            ),
          },
          {
            // Multi-valued: 1.0 renders this as a comma list.
            header: "Company",
            cell: (row) => <ChipsCell items={row.companies} />,
          },
        ]}
      />
    </>
  );
}
