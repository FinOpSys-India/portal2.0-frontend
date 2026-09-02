import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { PersonCell } from "@/components/admin/initials-avatar";
import { PageHeader } from "@/components/portal/portal-shell";
import { ProgressBar } from "@/components/portal/progress-bar";
import {
  companyScope,
  type ManagedProject,
  managerApi,
  scopeName,
} from "@/lib/manager";

import { NewProject } from "./new-project";

export const metadata: Metadata = { title: "Projects" };

export default async function ManagerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const company = await companyScope((await searchParams).company);
  const [projects, companies] = await Promise.all([
    managerApi.projects(company),
    managerApi.companies(),
  ]);

  return (
    <>
      {/* `POST /projects` admits an ACCOUNTING_MANAGER and always has; this
          portal simply had no control that called it, so every job had to be
          opened from the client's side of the account. */}
      <PageHeader
        // Not "All Projects". The portal reads one company at a time, so the
        // table below has never been all of anything — it is this company's.
        title="Projects"
        scope={await scopeName(company)}
        action={
          <NewProject
            companies={companies.map(({ id, name }) => ({ id, name }))}
            defaultCompanyId={company}
          />
        }
      />

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
            // Read-only: it follows the company's staffing for this project's
            // service line, which is the Companies screen's Assign Specialist.
            header: "Specialist",
            cell: (row) =>
              row.specialist ? (
                <PersonCell name={row.specialist} />
              ) : (
                <span className="text-muted-foreground">Unassigned</span>
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
