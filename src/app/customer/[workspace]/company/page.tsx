import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable, ListCell } from "@/components/admin/data-table";
import { AvatarStack } from "@/components/admin/initials-avatar";
import { customerApi, type CustomerCompany } from "@/lib/customer";

import { AddCompany } from "./add-company";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ page?: string; sort?: string; dir?: string }>;
}) {
  const [{ workspace }, { page: raw, sort, dir }] = await Promise.all([
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
      <PageHeader
        title="Company"
        action={<AddCompany accountEmail={profile.email} />}
      />

      <DataTable<CustomerCompany>
        page={page}
        sort={sort}
        dir={dir}
        total={companies.length}
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
            sortValue: (row) => Date.parse(row.subscriptionDate ?? "") || 0,
            cell: (row) =>
              row.subscriptionDate ?? (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            header: "Team Members",
            sortValue: (row) => row.teamMembers.length,
            cell: (row) => <AvatarStack names={row.teamMembers} />,
          },
        ]}
      />
    </>
  );
}
