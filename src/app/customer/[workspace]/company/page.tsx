import type { Metadata } from "next";

import {
  DataTable,
  ListCell,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { AvatarStack } from "@/components/admin/initials-avatar";
import { customerApi, type CustomerCompany } from "@/lib/customer";
import { dateKey, withTeammates } from "@/lib/portal";

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
    size?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const [{ workspace }, { page: raw, size: rawSize, sort, dir, f }] =
    await Promise.all([params, searchParams]);
  const page = parsePage(raw);
  const size = parsePageSize(rawSize);
  const [owned, profile] = await Promise.all([
    customerApi.companies(),
    customerApi.profile(),
  ]);
  // The company read names the account team — owner, accounting manager,
  // specialists — and never the colleagues this customer invited themselves.
  const companies = await withTeammates(owned);

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
      // The frame stays on the open workspace — a company is read from
      // wherever you stand, the switcher is what moves you.
      rowHref={(row) =>
        `/customer/${encodeURIComponent(workspace)}/company/${encodeURIComponent(row.id)}`
      }
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
          sortValue: (row) => dateKey(row.subscriptionDate),
          cell: (row) =>
            row.subscriptionDate ?? (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          header: "Team Members",
          filter: "number",
          sortValue: (row) => row.teamMembers.length,
          cell: (row) => <AvatarStack people={row.teamMembers} />,
        },
      ]}
    />
  );
}
