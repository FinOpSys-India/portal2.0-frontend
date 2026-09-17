import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { api } from "@/lib/api";
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
  // All three in parallel: the roster is the table, `workspaces` is the invite
  // dialog's company checklist — the companies this owner can put someone on —
  // and `isOwner` is whether they may open it at all.
  const [team, companies, { isOwner }] = await Promise.all([
    customerApi.team(workspace),
    customerApi.workspaces(),
    api.onboardingStatus(),
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
       * ONLY AN OWNER INVITES, and `isOwner` is the test rather than a side
       * effect of the company list.
       *
       * `POST /invitations/teammates` sits behind `requireRole('OWNER')`
       * (invitationRoutes.js), so a teammate opening this dialog fills a form
       * that can only end in a 403. The old guard was `companies.length > 0`,
       * which reads the same TODAY only because `workspaces()` lists companies
       * the caller OWNS and a teammate owns none. That stops being true the day
       * membership is counted and this picker starts listing companies someone
       * merely belongs to — at which point the proxy silently inverts and hands
       * every teammate the button. Asking the question the endpoint asks
       * survives that change.
       *
       * The company list still has to be non-empty: an owner mid-signup has
       * nobody to invite onto anything, and the dialog's checklist is required.
       */
      action={
        isOwner && companies.length > 0 ? (
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
