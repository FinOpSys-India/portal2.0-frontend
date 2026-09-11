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
  // The checklist names every company this manager handles, not only the ones
  // held by the customers on screen — same reason the admin list reads its
  // company list separately.
  const [customers, companies] = await Promise.all([
    managerApi.customers(company),
    managerApi.companies(),
  ]);

  return (
    <DataTable<ManagerCustomer>
      title="Customers"
      scope={await scopeName(company)}
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={customers.length}
      rows={customers}
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
          filter: "list",
          filterValues: (row) => row.companies,
          filterOptions: companies.map((row) => row.name),
          cell: (row) => <ChipsCell items={row.companies} />,
        },
      ]}
    />
  );
}
