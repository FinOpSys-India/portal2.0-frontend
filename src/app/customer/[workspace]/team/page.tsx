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
  /*
   * Both in parallel: the roster is the table, and the OWNED companies are the
   * invite dialog's checklist.
   *
   * `ownedCompanies()`, not `workspaces()`. The picker now answers "companies I
   * can open", which includes ones this person merely belongs to — and
   * `POST /invitations/teammates` refuses any company the caller does not own.
   * Feeding the checklist from the wider list would offer boxes that 403 on
   * submit.
   */
  const [team, owned] = await Promise.all([
    customerApi.team(workspace),
    api.ownedCompanies(),
  ]);

  const companies = owned.map((c) => ({
    id: String(c.companyId),
    name: c.companyName,
  }));

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
       * THE BUTTON BELONGS TO THE COMPANY ON SCREEN, not to the account.
       *
       * The test is ownership of THIS workspace, not ownership of something
       * somewhere: a customer can own one company and be a teammate on another,
       * and "Invite Teammate" sitting on a company they merely belong to would
       * open a dialog whose only tickable boxes are OTHER companies. It also
       * settles the role question on its own — `/companies/owned` filters on
       * `ownerUserId`, so a teammate matches nothing here, which is exactly what
       * `POST /invitations/teammates` (behind `requireRole('OWNER')`) enforces
       * server-side.
       *
       * The whole owned list still goes to the dialog: one invitation can name
       * several companies, and an owner looking at one of theirs may well want
       * to grant the rest in the same breath.
       */
      action={
        companies.some((c) => c.id === workspace) ? (
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
