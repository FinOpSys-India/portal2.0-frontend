import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProgressBar } from "@/components/portal/progress-bar";
import { PageHeader } from "@/components/portal/portal-shell";
import { scoped, type ManagedProject } from "@/lib/manager";
import { specialistApi } from "@/lib/specialist";

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
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const projects = await specialistApi.projects(company);

  return (
    <>
      <PageHeader title="Projects" />

      <DataTable<ManagedProject>
        page={1}
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
            header: "Project",
            cell: (row) => <span className="font-medium">{row.name}</span>,
          },
          // Not a design column: the design is always scoped to one company, so
          // it never needs to say which. This list is unscoped by default.
          { header: "Company", cell: (row) => row.company },
          {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            header: "Deadline",
            cell: (row) => (
              <span className="tabular-nums">{row.deadline}</span>
            ),
          },
          {
            header: "Project Progress",
            cell: (row) => <ProgressBar value={row.progress} />,
          },
        ]}
      />
    </>
  );
}
