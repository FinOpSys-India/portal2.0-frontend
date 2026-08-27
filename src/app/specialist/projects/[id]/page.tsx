import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AddTask } from "@/components/portal/add-task";
import { PageHeader } from "@/components/portal/portal-shell";
import { StatusBadge } from "@/components/portal/status-badge";
import { ProjectTaskTable } from "@/components/portal/project-task-table";
import { fileKind, formatFileSize } from "@/lib/manager";
import { specialistApi } from "@/lib/specialist";

import { SpecialistUploadFile } from "../../documents/upload-file";

export const metadata: Metadata = { title: "Project" };

/**
 * Project Details — the manager's project screen in the same three regions:
 * task list and project details stacked on the left, files in a right rail.
 *
 * Two differences, both because this is the person doing the work rather than
 * the one routing it: the status column is a menu, not a badge, and there is no
 * Assign Specialist action.
 *
 * The design labels the task table's first column `File name`
 * (docs/specialist-portal.md) on a table that holds task names. Named for what
 * it holds.
 */
export default async function SpecialistProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Null covers both "no such project" and "not yours" — the second must not
  // be distinguishable from the first, or the id becomes a lookup oracle.
  const project = await specialistApi.project(id);
  if (!project) notFound();

  const [tasks, documents] = await Promise.all([
    specialistApi.tasks(project.id),
    specialistApi.documents(project.companyId),
  ]);

  const attached = documents.filter((d) => d.project === project.name);

  return (
    <>
      <PageHeader
        title="Project Details"
        description={`${project.name} · ${project.company}`}
        action={<StatusBadge status={project.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-4 border-b border-border p-6">
              <h2 className="text-sm font-semibold">Task List</h2>
              <AddTask
                from="specialist"
                projects={[{ id: project.id, name: project.name }]}
              />
            </div>

            <ProjectTaskTable tasks={tasks} from="specialist" />
          </section>

          <DetailSection title="Project Details">
            <DetailRow label="Created On" value={project.createdOn} />
            <DetailRow label="Deadline" value={project.deadline} />
            <DetailRow label="Services Name" value={project.service} />
            <DetailRow label="Company Name" value={project.company} />
            <DetailRow label="Created By" value={project.createdBy} />
          </DetailSection>
        </div>

        <section className="rounded-xl border border-border bg-card p-6 lg:self-start">
          <h2 className="mb-4 text-sm font-semibold">Project Files</h2>

          <div className="mb-4 flex gap-2">
            {/*
             * Upload was disabled behind "the backend does not have file
             * storage yet". It does — GET /api/health reports
             * `storage: "supabase"`, and the File Organizer on the next tab has
             * been uploading through the same three-step handshake all along.
             * The dialog is pre-scoped to this project, so there is nothing to
             * choose here that the page does not already know.
             *
             * Download stays out: the bulk endpoint is a POST returning signed
             * links, and no boundary function calls it yet. A per-file control
             * belongs on the row rather than above the list.
             */}
            <SpecialistUploadFile
              companies={[{ id: project.companyId, name: project.company }]}
              projects={[{ name: project.name, companyId: project.companyId }]}
            />
          </div>

          {attached.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files attached.</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {attached.map((doc) => (
                <li key={doc.id} className="flex items-baseline gap-2 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {doc.name}
                  </span>
                  {/* The design carries a per-type icon and a size here. The
                      size is the half that says something a reader cannot get
                      from the file name. */}
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {fileKind(doc.name)} · {formatFileSize(doc.size)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
