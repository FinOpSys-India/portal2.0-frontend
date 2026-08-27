import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { customerApi, type TeamMember } from "@/lib/customer";
import { InviteTeammate } from "./invite-teammate";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ workspace }, { page: raw }] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number(raw) || 1);
  const team = await customerApi.team(workspace);

  return (
    <>
      <PageHeader
        title="Team"
        action={<InviteTeammate workspaceId={workspace} />}
      />

      <DataTable<TeamMember>
        page={page}
        total={team.length}
        rows={team}
        basePath={`/customer/${workspace}/team`}
        empty="No teammates yet. Invite someone to share access."
        columns={[
          { header: "Name", cell: (row) => <PersonCell name={row.name} /> },
          { header: "Job Title", cell: (row) => row.jobTitle },
          {
            header: "Email Address",
            cell: (row) => (
              <span className="text-muted-foreground">{row.email}</span>
            ),
          },
        ]}
      />
    </>
  );
}
