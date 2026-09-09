import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProgressBar } from "@/components/portal/progress-bar";
import { type ManagedProject, parseDeadline, scoped } from "@/lib/manager";
import { companyScope, scopeName, specialistApi } from "@/lib/specialist";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Projects" };

/**
 * Projects — the work routed to this specialist, and nothing else. A project
 * reaches them through their speciality: the manager assigns the bookkeeping
 * jobs to a bookkeeper, payroll to a payroll specialist, and so on.
 *
 * Columns are the design's (docs/specialist-portal.md), minus its per-row `⋮`
 * menu — the specialist has no row-level action to put in one.
 */
export default async function SpecialistProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    company?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const { company: picked, sort, dir, f } = await searchParams;
  const company = await companyScope(picked);
  const projects = await specialistApi.projects(company);

  return (
    <DataTable<ManagedProject>
      title="Projects"
      scope={await scopeName(company)}
      page={1}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={projects.length}
      rows={projects}
      basePath="/specialist/projects"
      rowHref={(row) => scoped(`/specialist/projects/${row.id}`, company)}
      empty={
        company
          ? "No projects assigned to you at this company."
          : "No projects assigned to you yet."
      }
      columns={[
        {
          header: "Project Name",
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        // Not a design column: the design is always scoped to one company, so
        // it never needs to say which. This list is unscoped by default.
        { header: "Company", filter: "enum", cell: (row) => row.company },
        {
          header: "Status",
          filter: "enum",
          sortValue: (row) => row.status,
          cell: (row) => <StatusBadge status={row.status} />,
        },
        {
          header: "Deadline",
          filter: "date",
          sortValue: (row) => parseDeadline(row.deadline).getTime(),
          cell: (row) => <span className="tabular-nums">{row.deadline}</span>,
        },
        {
          header: "Project Progress",
          filter: "number",
          sortValue: (row) => row.progress,
          cell: (row) => <ProgressBar value={row.progress} />,
        },
      ]}
    />
  );
}
