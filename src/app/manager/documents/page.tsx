import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import {
  DOCUMENT_COLUMNS,
  ScopeBreadcrumb,
} from "@/components/portal/file-list";
import { ProjectFilter } from "@/components/portal/project-filter";
import { managerApi, type ManagerDocument } from "@/lib/manager";
import { ManagerUploadFile } from "./upload-file";

export const metadata: Metadata = { title: "Files" };

/**
 * All Documents — the file organiser, newest upload first.
 *
 * Two filters, both in the URL: the header's company switcher and this page's
 * project pill. The breadcrumb spells out the resulting scope, because two
 * pills in two different places otherwise leave the reader guessing what the
 * list is showing.
 */
export default async function ManagerDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; project?: string }>;
}) {
  const { company, project } = await searchParams;

  const [documents, projects, companies, profile] = await Promise.all([
    managerApi.documents(company, project),
    managerApi.projects(company),
    managerApi.companies(),
    managerApi.profile(),
  ]);

  // Unscoped upload needs the whole book; the pills only narrow what is shown.
  const allProjects = company ? await managerApi.projects() : projects;

  // From the company list, not from the projects: a company with no projects
  // yet would otherwise fall back to "All companies" while scoped to it.
  const companyName = companies.find((c) => c.id === company)?.name ?? null;

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
        basePath="/manager/documents"
        header={
          <>
            <h1 className="text-lg font-bold tracking-tight">All Documents</h1>
            <ManagerUploadFile
              companies={companies.map(({ id, name }) => ({ id, name }))}
              projects={allProjects.map(({ name, companyId }) => ({
                name,
                companyId,
              }))}
              owner={profile.name}
            />
          </>
        }
        empty={
          project
            ? "No documents on this project yet."
            : "No documents yet."
        }
        columns={DOCUMENT_COLUMNS}
      />
    </>
  );
}

