import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { ExportProjectsCsv } from "@/components/portal/export-csv";
import { PersonCell } from "@/components/admin/initials-avatar";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProjectDeadline } from "@/components/portal/project-deadline";
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
  const [projects, services] = await Promise.all([
    customerApi.projects(workspace),
    customerApi.availableServices(workspace),
  ]);

  return (
    <DataTable<Project>
      title="Projects"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={projects.length}
      exportCsv={(filtered) => (
        <ExportProjectsCsv companyId={workspace} filtered={filtered} />
      )}
      action={<NewProject workspaceId={workspace} services={services} />}
      rows={projects}
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
          cell: (row) => (
            <ProjectDeadline deadline={row.deadline} status={row.status} />
          ),
        },
        {
          header: "Status",
          filter: "enum",
          sortValue: (row) => row.status,
          cell: (row) => <StatusBadge status={row.status} />,
        },
        {
          header: "Specialist",
          /*
           * A CHECKLIST, not a text box.
           *
           * Without `filter` this fell through to the default "text", so
           * narrowing to one person's work meant typing their name and
           * spelling it the way the row does. A company runs a handful of
           * specialists, which is what `enum` is for.
           *
           * `filterValues` rather than leaning on `sortValue`, because the
           * empty string it returns for an unstaffed project is dropped from
           * the options list — and "who has nothing assigned yet" is the
           * question this column is most often opened to answer. Named the
           * same thing the cell prints.
           */
          filter: "enum",
          filterValues: (row) => [row.specialist ?? "Unassigned"],
          sortValue: (row) => row.specialist ?? "",
          cell: (row) =>
            row.specialist ? (
              <PersonCell
                name={row.specialist}
                avatarUrl={row.specialistAvatarUrl}
              />
            ) : (
              <span className="text-muted-foreground">Unassigned</span>
            ),
        },
      ]}
    />
  );
}
