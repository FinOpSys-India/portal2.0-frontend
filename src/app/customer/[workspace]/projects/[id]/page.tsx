import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PersonCell } from "@/components/admin/initials-avatar";
import { FilePreview } from "@/components/portal/file-preview";
import { StatusBadge } from "@/components/portal/status-badge";
import { ExportProjectCsv } from "@/components/portal/export-csv";
import { PageHeader } from "@/components/portal/portal-shell";
import { customerApi, type CustomerFile } from "@/lib/customer";
import { documentPath } from "@/lib/portal";
import { parseFilters } from "@/lib/table-filter";

export const metadata: Metadata = { title: "Project" };

/**
 * Project detail. 1.0 has this screen (customer-project-detail.png) but we
 * never reached it with a populated list, so the field set is the row's data
 * plus the files attached to it — everything we can show without inventing.
 */
export default async function CustomerProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspace: string; id: string }>;
  searchParams: Promise<{
    page?: string;
    sort?: string;
    dir?: string;
    f?: string | string[];
  }>;
}) {
  const [{ workspace, id }, { page: raw, sort, dir, f }] = await Promise.all([
    params,
    searchParams,
  ]);
  const page = Math.max(1, Number(raw) || 1);
  const project = await customerApi.project(workspace, id);

  if (!project) notFound();

  const files = await customerApi.files(workspace, project.name);

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
          <DetailRow label="Deadline" value={project.deadline} />
          <DetailRow label="Status" value={project.status} />
          <DetailRow
            label="Specialist"
            value={project.specialist ?? "Not yet assigned"}
          />
        </DetailSection>

        <section>
          <h2 className="mb-3 text-sm font-semibold">Attached Files</h2>
          <DataTable<CustomerFile>
            page={page}
            sort={sort}
            dir={dir}
            filters={parseFilters(f)}
            total={files.length}
            rows={files}
            basePath={`/customer/${workspace}/projects/${id}`}
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
                cell: (row) => <PersonCell name={row.owner} />,
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
