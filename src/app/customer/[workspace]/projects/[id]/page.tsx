import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DataTable } from "@/components/admin/data-table";
import { DetailRow, DetailSection } from "@/components/admin/detail";
import { PersonCell } from "@/components/admin/initials-avatar";
import { StatusBadge } from "@/components/portal/status-badge";
import { PageHeader } from "@/components/portal/portal-shell";
import { customerApi, type CustomerFile } from "@/lib/customer";

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
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ workspace, id }, { page: raw }] = await Promise.all([
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
        action={<StatusBadge status={project.status} />}
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
          <h2 className="mb-3 text-sm font-semibold">Attached files</h2>
          <DataTable<CustomerFile>
            page={page}
            total={files.length}
            rows={files}
            basePath={`/customer/${workspace}/projects/${id}`}
            empty="No files attached to this project yet."
            columns={[
              {
                header: "File Name",
                cell: (row) => <span className="font-medium">{row.name}</span>,
              },
              {
                header: "Uploaded By",
                cell: (row) => <PersonCell name={row.owner} />,
              },
              {
                header: "Upload Date",
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
