import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { customerApi, type TeamMember } from "@/lib/customer";
import { InviteTeammate } from "./invite-teammate";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({
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
  const team = await customerApi.team(workspace);

  return (
    <DataTable<TeamMember>
      title="Team"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={team.length}
      action={<InviteTeammate workspaceId={workspace} />}
      rows={team}
      empty="No teammates yet. Invite someone to share access."
      columns={[
        {
          header: "Name",
          sortValue: (row) => row.name,
          cell: (row) => <PersonCell name={row.name} />,
        },
        { header: "Job Title", cell: (row) => row.jobTitle },
        {
          header: "Email Address",
          cell: (row) => (
            <span className="text-muted-foreground">{row.email}</span>
          ),
        },
      ]}
    />
  );
}
