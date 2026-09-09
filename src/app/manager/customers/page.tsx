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
import { parseFilters } from "@/lib/table-filter";

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
  searchParams: Promise<{ company?: string; sort?: string; dir?: string; f?: string | string[] }>;
}) {
  const { company: picked, sort, dir, f } = await searchParams;
  const company = await companyScope(picked);
  const customers = await managerApi.customers(company);

  return (
    <>
      <PageHeader title="Customers" scope={await scopeName(company)} />

      <DataTable<ManagerCustomer>
        page={1}
        sort={sort}
        dir={dir}
        filters={parseFilters(f)}
        total={customers.length}
        rows={customers}
        basePath="/manager/customers"
        rowHref={(row) => `/manager/customers/${encodeURIComponent(row.email)}`}
        empty="No customers on this company yet."
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
            cell: (row) => <RoleBadge role={row.role} />,
          },
          {
            header: "Email",
            cell: (row) => (
              <span className="text-muted-foreground">{row.email}</span>
            ),
          },
          {
            // Multi-valued: 1.0 renders this as a comma list.
            header: "Company",
            sortValue: (row) => row.companies.join(", "),
            cell: (row) => <ChipsCell items={row.companies} />,
          },
        ]}
      />
    </>
  );
}
