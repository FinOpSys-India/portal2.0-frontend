import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  DataTable,
  parsePage,
  parsePageSize,
} from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PersonCell } from "@/components/admin/initials-avatar";
import { FilePreview } from "@/components/portal/file-preview";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProjectDeadline } from "@/components/portal/project-deadline";
import { ExportProjectCsv } from "@/components/portal/export-csv";
import { PageHeader } from "@/components/portal/portal-shell";
import { ProjectTaskTable } from "@/components/portal/project-task-table";
import { customerApi, type CustomerFile } from "@/lib/customer";
import { documentPath } from "@/lib/portal";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Project" };

/**
 * Project detail. 1.0 has this screen (customer-project-detail.png) but we
 * never reached it with a populated list, so the field set is the row's data,
 * the tasks the AM has broken it into, and the files attached to it.
 *
 * The task list is read-only here: the customer cannot add a task or move its
 * status (docs/functionality-matrix.md), they watch the AM's breakdown progress.
 */
export default async function CustomerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<{
    page?: string;
    size?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const [{ workspace, id }, { page: raw, size: rawSize, sort, dir, f }] =
    await Promise.all([params, searchParams]);
  const page = parsePage(raw);
  const size = parsePageSize(rawSize);
  const project = await customerApi.project(workspace, id);

  if (!project) notFound();

  const [tasks, files] = await Promise.all([
    customerApi.tasks(project.id),
    customerApi.files(workspace, project.name),
  ]);

  return (
    <>
      <PageHeader
        title={project.name}
        /* A DIV, not a fragment: PageHeader's row is `justify-between`, so two
           bare children would be pushed to opposite ends of it with the title
           stranded between them. These two are a pair on the right. */
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={project.status} />
            <ExportProjectCsv projectId={project.id} projectName={project.name} />
          </div>
        }
      />

      <div className="grid gap-6">
        <DetailSection title="Details">
          <DetailRow label="Service" value={project.service} />
          <DetailRow
            label="Deadline"
            value={
              <ProjectDeadline
                deadline={project.deadline}
                status={project.status}
              />
            }
          />
          <DetailRow label="Status" value={project.status} />
          <DetailRow
            label="Specialist"
            value={project.specialist ?? "Not yet assigned"}
          />
        </DetailSection>

        <section className="rounded-xl border border-border bg-card">
          <div className="border-b border-border p-6">
            <h2 className="text-sm font-semibold">Task List</h2>
          </div>
          <ProjectTaskTable tasks={tasks} from="customer" sort={sort} dir={dir} />
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Attached Files</h2>
          <DataTable<CustomerFile>
            page={page}
            size={size}
            sort={sort}
            dir={dir}
            filters={parseFilters(f)}
            total={files.length}
            rows={files}
            empty="No files attached to this project yet."
            columns={[
              {
                header: "Document Name",
                // The cell is a client component, so the text it renders cannot
                // be walked for a sort key — the name is passed instead.
                sortValue: (row) => row.name,
                cell: (row) => (
                  <FilePreview
                    name={row.name}
                    href={documentPath(row)}
                    size={row.size}
                    className="block max-w-full font-medium"
                  />
                ),
              },
              {
                header: "Uploaded By",
                sortValue: (row) => row.owner,
                cell: (row) => <PersonCell name={row.owner} avatarUrl={row.ownerAvatarUrl} />,
              },
              {
                header: "Upload Date",
                sortValue: (row) => Date.parse(row.uploadedAt) || 0,
                cell: (row) => (
                  <span className="text-muted-foreground">
                    {row.uploadedAt}
                  </span>
                ),
              },
            ]}
          />
        </section>
      </div>
    </>
  );
}
