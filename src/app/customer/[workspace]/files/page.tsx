import type { Metadata } from "next";
import { redirect } from "next/navigation";

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
import { customerApi } from "@/lib/customer";
import {
  archivedDocuments,
  isOpenProject,
  onServiceTab,
  outsideInactive,
  parseServiceTab,
  serviceHref,
  viewerId,
  withService,
} from "@/lib/portal";

import { CustomerUploadFile } from "./upload-file";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Documents" };

/**
 * Documents — the same table the staff portals render, narrowed to one
 * workspace.
 *
 * One filter rather than their two: the company is the URL segment, so only
 * the project pill is a choice here. The breadcrumb still spells the scope out,
 * because the company that scopes this list is named in the header and the
 * project in a pill, and a reader should not have to assemble that.
 *
 * The service comes from the sidebar row the reader came in by, and scopes
 * everything on the page with it: the list, the project pill and the projects
 * the upload dialog offers.
 */
export default async function FilesPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string }>;
  searchParams: Promise<{
    project?: string;
    page?: string;
    size?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
    view?: string;
    service?: string;
  }>;
}) {
  const [
    { workspace },
    { project, page: raw, size: rawSize, sort, dir, f, service: rawService },
  ] = await Promise.all([params, searchParams]);
  const page = parsePage(raw);
  const view = parseDocumentsView((await searchParams).view);
  const service = parseServiceTab(rawService);
  const path = `/customer/${workspace}/files`;
  const size = parsePageSize(rawSize);

  // As on Projects: a URL that names no service goes to the first service row,
  // unless the company has none.
  if (service === "all") {
    const [first] = await customerApi.serviceGroups(workspace);
    if (first) redirect(serviceHref(path, first));
  }

  const [files, all, viewer] = await Promise.all([
    customerApi.files(workspace, project),
    customerApi.projects(workspace),
    // Who "delete" is offered to: the uploader of the row, nobody else.
    viewerId(),
  ]);

  const rows = (
    view === "archive"
      ? await archivedDocuments<FileRow>()
      : withService(outsideInactive(files, all), all)
  ).filter((r) => onServiceTab(r, service));
  const projects = all.filter((p) => onServiceTab(p, service));

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
              href={(v) => viewHref(serviceHref(path, service), v)}
            />
          }
          action={
            <>
              <SelectionBar archived={view === "archive"} />
              <CustomerUploadFile
                workspace={workspace}
                projects={projects.filter(isOpenProject).map(({ name }) => ({ name }))}
              />
            </>
          }
          empty={
            view === "archive"
              ? "No archived documents."
              : project
              ? "No files on this project yet."
              : "No files yet. Your accounting team will add them here."
          }
          columns={
            view === "archive" ? archiveColumns(viewer) : fileColumns(viewer)
          }
        />
      </DocumentSelection>
    </>
  );
}
