import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { AvatarStack } from "@/components/admin/initials-avatar";
import { customerApi, type CustomerCompany } from "@/lib/customer";

import { AddCompany } from "./add-company";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Company" };

export default async function CompanyPage({
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
  const [companies, profile] = await Promise.all([
    customerApi.companies(),
    customerApi.profile(),
  ]);

  return (
    <DataTable<CustomerCompany>
      title="Company"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={companies.length}
      action={<AddCompany accountEmail={profile.email} />}
      rows={companies}
      empty="No companies yet."
      columns={[
        {
          header: "Company Name",
          // A checklist, like every other place a list is narrowed by company:
          // picking three companies is one filter, where Contains can only ask
          // about one spelling at a time.
          filter: "enum",
          sortValue: (row) => row.name,
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        {
          header: "Active Services",
          sortValue: (row) => row.activeServices.join(", "),
          filter: "list",
          filterValues: (row) => row.activeServices,
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
  );
}
