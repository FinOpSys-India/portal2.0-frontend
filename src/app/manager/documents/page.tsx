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
import { ProjectFilter } from "@/components/portal/project-filter";
import { companyScope, managerApi, scoped } from "@/lib/manager";
import {
  archivedDocuments,
  isOpenProject,
  outsideInactive,
  viewerId,
  withService,
} from "@/lib/portal";
import { ManagerUploadFile } from "./upload-file";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Documents" };

/**
 * Documents — the file organizer, newest upload first.
 *
 * Two filters, both in the URL: the header's company switcher and this page's
 * project pill. The breadcrumb spells out the resulting scope, because two
 * pills in two different places otherwise leave the reader guessing what the
 * list is showing.
 *
 * NO COMPANY COLUMN. `companyScope` resolves to exactly one company — the
 * switcher's pick, or the first on the book — so the column repeated one name
 * down every row, and the breadcrumb directly above the table already says it.
 * The specialist's copy of this page lost it for the same reason.
 */
export default async function ManagerDocumentsPage({
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
    managerApi.documents(company, project),
    managerApi.projects(company),
    managerApi.companies(),
    // Who "delete" is offered to: the uploader of the row, nobody else.
    viewerId(),
  ]);

  // Upload can still file against any company on the book; the pills only
  // narrow what the list below shows.
  const allProjects = await managerApi.projects();

  // From the company list, not from the projects: a company with no projects
  // yet would otherwise leave the breadcrumb blank while scoped to it.

  const rows =
    view === "archive"
      ? await archivedDocuments<FileRow>()
      : withService(outsideInactive(documents, allProjects), allProjects);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectFilter projects={projects.filter((p) => !p.inactive).map((p) => p.name)} />
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
              href={(v) => viewHref(scoped("/manager/documents", company), v)}
            />
          }
          action={
            <>
              <SelectionBar archived={view === "archive"} />
              <ManagerUploadFile
                companies={companies.map(({ id, name }) => ({ id, name }))}
                projects={allProjects.filter(isOpenProject).map(({ name, companyId }) => ({
                  name,
                  companyId,
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
