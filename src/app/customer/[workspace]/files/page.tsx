import type { Metadata } from "next";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import {
  fileColumns,
  type FileRow,
} from "@/components/portal/file-list";
import { ProjectFilter } from "@/components/portal/project-filter";
import { customerApi } from "@/lib/customer";
import { viewerId, withService } from "@/lib/portal";

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
  }>;
}) {
  const [{ workspace }, { project, page: raw, size: rawSize, sort, dir, f }] =
    await Promise.all([params, searchParams]);
  const page = parsePage(raw);
  const size = parsePageSize(rawSize);

  const [files, projects, viewer] = await Promise.all([
    customerApi.files(workspace, project),
    customerApi.projects(workspace),
    // Who "delete" is offered to: the uploader of the row, nobody else.
    viewerId(),
  ]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectFilter projects={projects.map((p) => p.name)} />
      </div>

      <DataTable<FileRow>
        page={page}
        size={size}
        sort={sort}
        dir={dir}
        filters={parseFilters(f)}
        noun="documents"
        total={files.length}
        rows={withService(files, projects)}
        title="Documents"
        action={
          <CustomerUploadFile
            workspace={workspace}
            projects={projects.map(({ name }) => ({ name }))}
          />
        }
        empty={
          project
            ? "No files on this project yet."
            : "No files yet. Your accounting team will add them here."
        }
        columns={fileColumns(viewer)}
      />
    </>
  );
}
