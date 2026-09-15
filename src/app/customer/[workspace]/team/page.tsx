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
  // Both, in parallel: the roster is the table, `workspaces` is the invite
  // dialog's company checklist — the companies this owner can put someone on.
  const [team, companies] = await Promise.all([
    customerApi.team(workspace),
    customerApi.workspaces(),
  ]);

  return (
    <DataTable<TeamMember>
      title="Team"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={team.length}
      /*
       * No companies to offer means no invite button.
       *
       * `POST /invitations/teammates` is OWNER-only, and this list is the
       * companies the caller owns. A teammate reading the roster of a company
       * they merely belong to would otherwise get a button that opens an empty
       * menu and ends in a 403.
       */
      action={
        companies.length > 0 ? (
          <InviteTeammate workspaceId={workspace} companies={companies} />
        ) : undefined
      }
      rows={team}
      empty="No teammates yet. Invite someone to share access."
      columns={[
        {
          header: "Name",
          sortValue: (row) => row.name,
          cell: (row) => <PersonCell name={row.name} avatarUrl={row.avatarUrl} />,
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
