import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable, ListCell } from "@/components/admin/data-table";
import { AvatarStack } from "@/components/admin/initials-avatar";
import { customerApi, type CustomerCompany } from "@/lib/customer";

import { AddCompany } from "./add-company";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const [{ workspace }, { page: raw, sort, dir, f }] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number(raw) || 1);
  const [companies, profile] = await Promise.all([
    customerApi.companies(),
    customerApi.profile(),
  ]);

  return (
    <>
      <PageHeader title="Company" />

      <DataTable<CustomerCompany>
        page={page}
        sort={sort}
        dir={dir}
        filters={parseFilters(f)}
        total={companies.length}
        action={<AddCompany accountEmail={profile.email} />}
        rows={companies}
        basePath={`/customer/${workspace}/company`}
        empty="No companies yet."
        columns={[
          {
            header: "Company Name",
            cell: (row) => <span className="font-medium">{row.name}</span>,
          },
          {
            header: "Active Services",
            sortValue: (row) => row.activeServices.join(", "),
            cell: (row) => <ListCell items={row.activeServices} />,
          },
          {
            header: "Subscription Date",
            filter: "date",
            sortValue: (row) => Date.parse(row.subscriptionDate ?? "") || 0,
            cell: (row) =>
              row.subscriptionDate ?? (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            header: "Team Members",
            filter: "number",
            sortValue: (row) => row.teamMembers.length,
            cell: (row) => <AvatarStack names={row.teamMembers} />,
          },
        ]}
      />
    </>
  );
}
