import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { ExportProjectsCsv } from "@/components/portal/export-csv";
import { ProgressBar } from "@/components/portal/progress-bar";
import { ProjectDeadline } from "@/components/portal/project-deadline";
import {
  companyScope,
  managerApi,
  parseDeadline,
  scoped,
  scopeName,
  type ManagedProject,
} from "@/lib/manager";

import { NewProject } from "./new-project";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Projects" };

export default async function ManagerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    size?: string;
    company?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const {
    company: picked,
    page: rawPage,
    size: rawSize,
    sort,
    dir,
    f,
  } = await searchParams;
  const page = parsePage(rawPage);
  const size = parsePageSize(rawSize);
  const company = await companyScope(picked);
  const [projects, companies] = await Promise.all([
    managerApi.projects(company),
    managerApi.companies(),
  ]);

  // `POST /projects` admits an ACCOUNTING_MANAGER and always has; this
  // portal simply had no control that called it, so every job had to be
  // opened from the client's side of the account.
  //
  // Columns are 1.0's, in 1.0's order. Status is deliberately absent: it
  // is not a column there, it lives on the project detail.
  const scope = await scopeName(company);

  return (
    <DataTable<ManagedProject>
      // Not "All Projects". The portal reads one company at a time, so the
      // table below has never been all of anything — it is this company's.
      title="Projects"
      scope={scope}
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={projects.length}
      exportCsv={(filtered) => (
        <ExportProjectsCsv
          companyId={company}
          companyName={scope}
          filtered={filtered}
        />
      )}
      // Add New Task is gone from this screen. It stays on a project's own
      // page, where the task being added has an obvious project; here the
      // dropdown had to ask which one, on a list whose job is the projects
      // themselves.
      action={
        <NewProject
          companies={companies.map(({ id, name }) => ({ id, name }))}
          defaultCompanyId={company}
        />
      }
      rows={projects}
      rowHref={(row) => scoped(`/manager/projects/${row.id}`, company)}
      empty="No projects for this company."
      columns={[
        {
          header: "Project Name",
          cell: (row) => <span className="font-medium">{row.name}</span>,
        },
        {
          header: "Service Type",
          filter: "enum",
          cell: (row) => row.service,
        },
        { header: "Created By", cell: (row) => row.createdBy },
        {
          header: "Deadline",
          filter: "date",
          // M/DD/YY: "8/03/26" sorts before "7/28/26" as text.
          sortValue: (row) => parseDeadline(row.deadline).getTime(),
          cell: (row) => (
            <ProjectDeadline deadline={row.deadline} status={row.status} />
          ),
        },
        {
          // Read-only: it follows the company's staffing for this project's
          // service line, which is the Companies screen's Assign Specialist.
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
          header: "Project Progress",
          filter: "number",
          sortValue: (row) => row.progress,
          cell: (row) => <ProgressBar value={row.progress} />,
        },
      ]}
    />
  );
}
