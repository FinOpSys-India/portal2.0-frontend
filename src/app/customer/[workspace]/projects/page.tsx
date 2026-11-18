import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { ExportProjectsCsv } from "@/components/portal/export-csv";
import { PersonCell } from "@/components/admin/initials-avatar";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProjectDeadline } from "@/components/portal/project-deadline";
import { ProjectTabs } from "@/components/portal/project-tabs";
import { customerApi, type Project } from "@/lib/customer";
import { parseDeadline } from "@/lib/manager";
import { NewProject } from "./new-project";
import { parseFilters } from "@/lib/table-filter";
import { ProjectRowActions } from "@/components/portal/record-controls";
import {
  onServiceTab,
  parseProjectTab,
  parseServiceTab,
  projectTab,
  serviceHref,
  tabHref,
  viewerId,
} from "@/lib/portal";

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
    tab?: string;
    service?: string;
  }>;
}) {
  const [
    { workspace },
    { page: raw, size: rawSize, sort, dir, f, tab: rawTab, service: rawService },
  ] = await Promise.all([params, searchParams]);
  const page = parsePage(raw);
  const size = parsePageSize(rawSize);
  const tab = parseProjectTab(rawTab);
  const service = parseServiceTab(rawService);
  const base = `/customer/${workspace}/projects`;

  // The sidebar's service rows are the way in to this list, so a URL that
  // names no service (the logo, the company switcher, an old bookmark) goes to
  // the first of them. Only a company with no service rows keeps the whole
  // list. Both reads behind this are memoized with the layout's.
  if (service === "all") {
    const [first] = await customerApi.serviceGroups(workspace);
    if (first) redirect(serviceHref(base, first));
  }

  // Only the table. The create dialog fetches its own service list when it is
  // opened — see NewProject — rather than every reader paying for one here.
  const [projects, viewer] = await Promise.all([
    customerApi.projects(workspace),
    viewerId(),
  ]);
  // The service is the sidebar's pick; the tabs count inside it.
  const inService = projects.filter((p) => onServiceTab(p, service));
  const rows = inService.filter((p) => projectTab(p) === tab);

  return (
    <DataTable<Project>
      title="Projects"
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={rows.length}
      tabs={
        <ProjectTabs
          current={tab}
          projects={inService}
          href={(t) => tabHref(serviceHref(base, service), t)}
        />
      }
      exportCsv={(filtered) => (
        <ExportProjectsCsv companyId={workspace} filtered={filtered} />
      )}
      action={
        <NewProject
          workspaceId={workspace}
          service={service}
          projects={projects.map(({ id, name }) => ({ id, name }))}
        />
      }
      rows={rows}
      // Carries the service, so the sidebar row stays lit on the project page.
      rowHref={(row) => serviceHref(`${base}/${row.id}`, service)}
      empty={
        tab === "active"
          ? "No projects yet. Create one to get started."
          : `No ${tab} projects.`
      }
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
        {
          // The creator's Inactive / Edit / Delete (15 Nov); empty for anyone
          // else, same rule as the project page.
          header: "Actions",
          filter: false,
          sortValue: false,
          cell: (row) => (
            <ProjectRowActions project={{ ...row, companyId: workspace }} mine={row.creatorId === viewer} />
          ),
        },
      ]}
    />
  );
}
