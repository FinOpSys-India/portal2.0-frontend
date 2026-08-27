import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import { AssignSpecialist } from "@/components/manager/assign-specialist";
import { ProgressBar } from "@/components/portal/progress-bar";
import { managerApi, type ManagedProject } from "@/lib/manager";

export const metadata: Metadata = { title: "Projects" };

export default async function ManagerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { company } = await searchParams;
  const [projects, specialists] = await Promise.all([
    managerApi.projects(company),
    managerApi.specialists(),
  ]);

  return (
    <>
      <PageHeader title="All Projects" />

      {/* Columns are 1.0's, in 1.0's order. Status is deliberately absent: it
          is not a column there, it lives on the project detail. */}
      <DataTable<ManagedProject>
        page={1}
        total={projects.length}
        rows={projects}
        basePath="/manager/projects"
        rowHref={(row) => `/manager/projects/${row.id}`}
        empty="No projects for this company."
        columns={[
          {
            header: "Project",
            cell: (row) => <span className="font-medium">{row.name}</span>,
          },
          { header: "Service Type", cell: (row) => row.service },
          { header: "Created By", cell: (row) => row.createdBy },
          { header: "Deadline", cell: (row) => row.deadline },
          {
            header: "Specialist",
            cell: (row) =>
              row.specialist ? (
                <PersonCell name={row.specialist} />
              ) : (
                <AssignSpecialist
                  projectId={row.id}
                  projectName={row.name}
                  specialists={specialists}
                />
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
