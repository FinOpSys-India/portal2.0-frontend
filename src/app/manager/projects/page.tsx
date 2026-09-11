import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { ExportProjectsCsv } from "@/components/portal/export-csv";
import { ProgressBar } from "@/components/portal/progress-bar";
import {
  companyScope,
  parseDeadline,
  type ManagedProject,
  managerApi,
  scopeName,
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
  return (
    <DataTable<ManagedProject>
      // Not "All Projects". The portal reads one company at a time, so the
      // table below has never been all of anything — it is this company's.
      title="Projects"
      scope={await scopeName(company)}
      page={page}
      size={size}
      sort={sort}
      dir={dir}
      filters={parseFilters(f)}
      total={projects.length}
      action={
        <>
          <ExportProjectsCsv
            companyId={company}
            companyName={await scopeName(company)}
          />
          <NewProject
            companies={companies.map(({ id, name }) => ({ id, name }))}
            defaultCompanyId={company}
          />
        </>
      }
      rows={projects}
      rowHref={(row) => `/manager/projects/${row.id}`}
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
          cell: (row) => row.deadline,
        },
        {
          // Read-only: it follows the company's staffing for this project's
          // service line, which is the Companies screen's Assign Specialist.
          header: "Specialist",
          sortValue: (row) => row.specialist ?? "",
          cell: (row) =>
            row.specialist ? (
              <PersonCell name={row.specialist} />
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
