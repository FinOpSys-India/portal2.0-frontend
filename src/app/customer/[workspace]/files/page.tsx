import type { Metadata } from "next";

import { DataTable } from "@/components/admin/data-table";
import { FILE_COLUMNS, ScopeBreadcrumb } from "@/components/portal/file-list";
import { ProjectFilter } from "@/components/portal/project-filter";
import { customerApi, type CustomerFile } from "@/lib/customer";

import { CustomerUploadFile } from "./upload-file";

export const metadata: Metadata = { title: "Files" };

/**
 * File Organizer — the same table the staff portals render, narrowed to one
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
  searchParams: Promise<{ project?: string; page?: string }>;
}) {
  const [{ workspace }, { project, page: raw }] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number(raw) || 1);

  const [files, projects, workspaces] = await Promise.all([
    customerApi.files(workspace, project),
    customerApi.projects(workspace),
    customerApi.workspaces(),
  ]);

  const companyName = workspaces.find((w) => w.id === workspace)?.name ?? null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <ProjectFilter projects={projects.map((p) => p.name)} />

        <ScopeBreadcrumb company={companyName} project={project ?? null} />
      </div>

      <DataTable<CustomerFile>
        page={page}
        total={files.length}
        rows={files}
        basePath={`/customer/${workspace}/files`}
        header={
          <>
            <h1 className="text-lg font-bold tracking-tight">All Documents</h1>
            <CustomerUploadFile
              workspace={workspace}
              projects={projects.map(({ name }) => ({ name }))}
            />
          </>
        }
        empty={
          project
            ? "No files on this project yet."
            : "No files yet. Your accounting team will add them here."
        }
        columns={FILE_COLUMNS}
      />
    </>
  );
}
