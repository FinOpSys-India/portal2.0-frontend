import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import {
  DOCUMENT_COLUMNS,
  ScopeBreadcrumb,
} from "@/components/portal/file-list";
import { ProjectFilter } from "@/components/portal/project-filter";
import type { ManagerDocument } from "@/lib/manager";
import { specialistApi } from "@/lib/specialist";

import { SpecialistUploadFile } from "./upload-file";

export const metadata: Metadata = { title: "Files" };

/**
 * File Organizer — every file on the companies this specialist works for,
 * newest upload first.
 *
 * Two filters, both in the URL: the header's company switcher and this page's
 * project pill. The breadcrumb spells out the resulting scope, because two
 * pills in two different places otherwise leave the reader guessing what the
 * list is showing.
 */
export default async function SpecialistDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; project?: string }>;
}) {
  const { company, project } = await searchParams;

  const [documents, projects, companies] = await Promise.all([
    specialistApi.documents(company, project),
    specialistApi.projects(company),
    specialistApi.companies(),
  ]);

  // From the company list, not from the projects: a company with no projects
  // left would otherwise fall back to "All companies" while scoped to it.
  const companyName = companies.find((c) => c.id === company)?.name ?? null;

  // Unscoped upload needs the whole book; the pills only narrow what is shown.
  const allProjects = company
    ? await specialistApi.projects()
    : projects;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectFilter projects={projects.map((p) => p.name)} />

        <ScopeBreadcrumb company={companyName} project={project ?? null} />
      </div>

      <DataTable<ManagerDocument>
        page={1}
        total={documents.length}
        rows={documents}
        basePath="/specialist/documents"
        header={
          <>
            <h1 className="text-lg font-bold tracking-tight">All Documents</h1>
            <SpecialistUploadFile
              companies={companies.map(({ id, name }) => ({ id, name }))}
              projects={allProjects.map((p) => ({
                name: p.name,
                companyId: p.companyId,
              }))}
            />
          </>
        }
        empty={
          project ? "No documents on this project yet." : "No documents yet."
        }
        columns={DOCUMENT_COLUMNS}
      />
    </>
  );
}
