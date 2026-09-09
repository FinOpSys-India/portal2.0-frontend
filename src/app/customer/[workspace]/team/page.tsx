import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
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
  const team = await customerApi.team(workspace);

  return (
    <DataTable<TeamMember>
      title="Team"
      page={page}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={team.length}
      action={<InviteTeammate workspaceId={workspace} />}
      rows={team}
      basePath={`/customer/${workspace}/team`}
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
