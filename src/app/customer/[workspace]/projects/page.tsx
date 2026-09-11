import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { ExportProjectsCsv } from "@/components/portal/export-csv";
import { PersonCell } from "@/components/admin/initials-avatar";
import { StatusBadge } from "@/components/portal/status-badge";
import { customerApi, type Project } from "@/lib/customer";
import { parseDeadline } from "@/lib/manager";
import { NewProject } from "./new-project";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({
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
  const [projects, services] = await Promise.all([
    customerApi.projects(workspace),
    customerApi.availableServices(workspace),
  ]);

  return (
    <DataTable<Project>
      title="Projects"
      page={page}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={projects.length}
      action={
        <>
          <ExportProjectsCsv companyId={workspace} />
          <NewProject workspaceId={workspace} services={services} />
        </>
      }
      rows={projects}
      basePath={`/customer/${workspace}/projects`}
      rowHref={(row) => `/customer/${workspace}/projects/${row.id}`}
      empty="No projects yet. Create one to get started."
      columns={[
        {
          header: "Project Name",
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        { header: "Service", filter: "enum", cell: (row) => row.service },
        {
          header: "Deadline",
          filter: "date",
          sortValue: (row) => parseDeadline(row.deadline).getTime(),
          cell: (row) => row.deadline,
        },
        {
          header: "Status",
          filter: "enum",
          sortValue: (row) => row.status,
          cell: (row) => <StatusBadge status={row.status} />,
        },
        {
          header: "Specialist",
          sortValue: (row) => row.specialist ?? "",
          cell: (row) =>
            row.specialist ? (
              <PersonCell name={row.specialist} />
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            ),
        },
      ]}
    />
  );
}
