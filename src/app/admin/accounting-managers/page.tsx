import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { ChipsCell, DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { adminApi, type AccountingManager } from "@/lib/admin";
import { InviteManager } from "./invite-manager";

export const metadata: Metadata = { title: "Accounting Managers" };

export default async function AccountingManagersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const { page: raw, sort, dir } = await searchParams;
  const page = Math.max(1, Number(raw) || 1);
  const { rows, total } = await adminApi.accountingManagers(page);

  return (
    <>
      <PageHeader title="Accounting Managers" action={<InviteManager />} />

      {/* No detail view: 1.0 has none, and there is nothing here a detail
          page would show that the row does not. */}
      <DataTable<AccountingManager>
        page={page}
        sort={sort}
        dir={dir}
        total={total}
        rows={rows}
        basePath="/admin/accounting-managers"
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
    </>
  );
}
