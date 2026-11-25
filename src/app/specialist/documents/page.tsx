import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import {
  fileColumns,
  type FileRow,
  archiveColumns,
  DocumentTabs,
  parseDocumentsView,
  viewHref,
} from "@/components/portal/file-list";
import {
  DocumentSelection,
  SelectionBar,
} from "@/components/portal/delete-documents";
import { scoped } from "@/lib/manager";
import { ProjectFilter } from "@/components/portal/project-filter";
import {
  isOpenProject,
  lockInactive,
  viewerId,
  withService,
} from "@/lib/portal";
import { companyScope, specialistApi } from "@/lib/specialist";

import { SpecialistUploadFile } from "./upload-file";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Documents" };

/**
 * Documents — the files on the company this specialist is scoped to,
 * newest upload first.
 *
 * Two filters, both in the URL: the header's company switcher and this page's
 * project pill. The breadcrumb spells out the resulting scope, because two
 * pills in two different places otherwise leave the reader guessing what the
 * list is showing.
 *
 * NO COMPANY COLUMN. `companyScope` resolves to exactly one company — the
 * switcher's pick, or the first they work — so the column repeated one name
 * down every row, and the breadcrumb directly above the table already says it.
 * The manager's copy of this page lost it for the same reason.
 */
export default async function SpecialistDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    size?: string;
    company?: string;
    project?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
    view?: string;
  }>;
}) {
  const {
    company: picked,
    page: rawPage,
    size: rawSize,
    project,
    sort,
    dir,
    f,
  } = await searchParams;
  const page = parsePage(rawPage);
  const view = parseDocumentsView((await searchParams).view);
  const size = parsePageSize(rawSize);
  const company = await companyScope(picked);

  const [documents, projects, companies, viewer] = await Promise.all([
    // The Archive tab reads the reader's own archive; Documents leaves it out.
    specialistApi.documents(company, project, view === "archive"),
    specialistApi.projects(company),
    specialistApi.companies(),
    // Who "delete" is offered to: the uploader of the row, nobody else.
    viewerId(),
  ]);

  // From the company list, not from the projects: a company with no projects
  // left would otherwise leave the breadcrumb blank while scoped to it.

  // Upload can still file against any company they work; the pills only narrow
  // what the list below shows.
  const allProjects = await specialistApi.projects();

  const rows = withService(lockInactive(documents, allProjects), allProjects);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectFilter projects={projects.map((p) => p.name)} />
      </div>

      <DocumentSelection>
        <DataTable<FileRow>
          page={page}
          size={size}
          sort={sort}
          dir={dir}
          filters={parseFilters(f)}
          noun="documents"
          total={rows.length}
          rows={rows}
          title="Documents"
          tabs={
            <DocumentTabs
              current={view}
              href={(v) => viewHref(scoped("/specialist/documents", company), v)}
            />
          }
          action={
            <>
              <SelectionBar archived={view === "archive"} />
              <SpecialistUploadFile
                companies={companies.map(({ id, name }) => ({ id, name }))}
                projects={allProjects.filter(isOpenProject).map((p) => ({
                  name: p.name,
                  companyId: p.companyId,
                }))}
              />
            </>
          }
          empty={
            view === "archive"
              ? "No archived documents."
              : project ? "No documents on this project yet." : "No documents yet."
          }
          columns={
            view === "archive" ? archiveColumns(viewer) : fileColumns(viewer)
          }
        />
      </DocumentSelection>
    </>
  );
}
