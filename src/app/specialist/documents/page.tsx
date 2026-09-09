import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import {
  documentColumns,
  ScopeBreadcrumb,
} from "@/components/portal/file-list";
import { ProjectFilter } from "@/components/portal/project-filter";
import type { ManagerDocument } from "@/lib/manager";
import { viewerId } from "@/lib/portal";
import { companyScope, specialistApi } from "@/lib/specialist";

import { SpecialistUploadFile } from "./upload-file";
import { parseFilters } from "@/lib/table-filter";

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
  searchParams: Promise<{
    company?: string;
    project?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const { company: picked, project, sort, dir, f } = await searchParams;
  const company = await companyScope(picked);

  const [documents, projects, companies, viewer] = await Promise.all([
    specialistApi.documents(company, project),
    specialistApi.projects(company),
    specialistApi.companies(),
    // Who "delete" is offered to: the uploader of the row, nobody else.
    viewerId(),
  ]);

  // From the company list, not from the projects: a company with no projects
  // left would otherwise leave the breadcrumb blank while scoped to it.
  const companyName = companies.find((c) => c.id === company)?.name ?? null;

  // Upload can still file against any company they work; the pills only narrow
  // what the list below shows.
  const allProjects = await specialistApi.projects();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectFilter projects={projects.map((p) => p.name)} />

        <ScopeBreadcrumb company={companyName} project={project ?? null} />
      </div>

      <DataTable<ManagerDocument>
        page={1}
        sort={sort}
        dir={dir}
        filters={parseFilters(f)}
        total={documents.length}
        rows={documents}
        basePath="/specialist/documents"
        header={
          <h1 className="text-lg font-bold tracking-tight">All Documents</h1>
        }
        action={
          <SpecialistUploadFile
            companies={companies.map(({ id, name }) => ({ id, name }))}
            projects={allProjects.map((p) => ({
              name: p.name,
              companyId: p.companyId,
            }))}
          />
        }
        empty={
          project ? "No documents on this project yet." : "No documents yet."
        }
        columns={documentColumns(viewer)}
      />
    </>
  );
}
