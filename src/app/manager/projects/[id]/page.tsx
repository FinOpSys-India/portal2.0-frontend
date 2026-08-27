import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AddTask } from "@/components/portal/add-task";
import { AssignSpecialist } from "@/components/manager/assign-specialist";
import { ProjectTaskTable } from "@/components/portal/project-task-table";
import { PageHeader } from "@/components/portal/portal-shell";
import { managerApi } from "@/lib/manager";

import { ManagerUploadFile } from "../../documents/upload-file";

export const metadata: Metadata = { title: "Project" };

/**
 * Project Information — task list, project details, project files, in 1.0's
 * arrangement (am-11-project-detail.png): the first two stacked on the left,
 * files in a right rail.
 */
export default async function ManagerProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await managerApi.project(id);

  if (!project) notFound();

  const [specialists, documents, tasks, profile] = await Promise.all([
    managerApi.specialists(),
    managerApi.documents(project.companyId),
    managerApi.tasks(project.id),
    managerApi.profile(),
  ]);

  const attached = documents.filter((d) => d.project === project.name);

  return (
    <>
      <PageHeader
        title="Project Information"
        description={project.name}
        action={
          project.specialist ? null : (
            <AssignSpecialist
              projectId={project.id}
              projectName={project.name}
              specialists={specialists}
            />
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-6">
          <section className="rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between gap-4 border-b border-border p-6">
              <h2 className="text-sm font-semibold">Task List</h2>
              <AddTask
                from="manager"
                projects={[{ id: project.id, name: project.name }]}
              />
            </div>

            <ProjectTaskTable tasks={tasks} from="manager" />
          </section>

          <DetailSection title="Project Details">
            <DetailRow label="Created On" value={project.createdOn} />
            <DetailRow label="Deadline" value={project.deadline} />
            <DetailRow label="Services Name" value={project.service} />
            <DetailRow label="Company Legal Name" value={project.company} />
            <DetailRow label="Created By" value={project.createdBy} />
          </DetailSection>
        </div>

        <section className="rounded-xl border border-border bg-card p-6 lg:self-start">
          <h2 className="mb-4 text-sm font-semibold">Project Files</h2>

          <div className="mb-4 flex gap-2">
            {/*
             * Upload was disabled behind "the backend does not have file
             * storage yet". It does — GET /api/health reports
             * `storage: "supabase"`, and All Documents has been uploading
             * through the same three-step handshake all along. Pre-scoped to
             * this project, so the dialog asks nothing the page already knows.
             *
             * Download stays out: the bulk endpoint is a POST returning signed
             * links, and no boundary function calls it yet. A per-file control
             * belongs on the row rather than above the list.
             */}
            <ManagerUploadFile
              companies={[{ id: project.companyId, name: project.company }]}
              projects={[{ name: project.name, companyId: project.companyId }]}
              owner={profile.name}
            />
          </div>

          {attached.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files attached.</p>
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {attached.map((doc) => (
                <li key={doc.id} className="py-3 text-sm">
                  {doc.name}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
