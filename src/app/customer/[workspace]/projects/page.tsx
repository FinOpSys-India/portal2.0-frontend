import type { Metadata } from "next";

import { PageHeader } from "@/components/portal/portal-shell";
import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { StatusBadge } from "@/components/portal/status-badge";
import { customerApi, type Project } from "@/lib/customer";
import { NewProject } from "./new-project";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
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
  const [projects, services] = await Promise.all([
    customerApi.projects(workspace),
    customerApi.availableServices(workspace),
  ]);

  return (
    <>
      <PageHeader
        title="Projects"
        action={<NewProject workspaceId={workspace} services={services} />}
      />

      <DataTable<Project>
        page={page}
        total={projects.length}
        rows={projects}
        basePath={`/customer/${workspace}/projects`}
        rowHref={(row) => `/customer/${workspace}/projects/${row.id}`}
        empty="No projects yet. Create one to get started."
        columns={[
          {
            header: "Project",
            cell: (row) => <span className="font-medium">{row.name}</span>,
          },
          { header: "Service", cell: (row) => row.service },
          { header: "Deadline", cell: (row) => row.deadline },
          {
            header: "Status",
            cell: (row) => <StatusBadge status={row.status} />,
          },
          {
            header: "Specialist",
            cell: (row) =>
              row.specialist ? (
                <PersonCell name={row.specialist} />
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
              ),
          },
        ]}
      />
    </>
  );
}
