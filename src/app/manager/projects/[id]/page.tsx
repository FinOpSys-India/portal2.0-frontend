import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DetailRow, DetailSection } from "@/components/admin/detail";
import { AddTask } from "@/components/portal/add-task";
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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  const [{ id }, { company }] = await Promise.all([params, searchParams]);
  const project = await managerApi.project(id);

  /*
   * The scope and the record have to agree. A detail page is a single record, so
   * the switcher does not filter it — but a URL that NAMES a company and a
   * project belonging to a different one is describing two different accounts at
   * once, and the tasks below would then be a project the Projects list two
   * clicks away does not have.
   *
   * Only when the URL says so. Arriving without `?company=` is a bare link, not
   * a contradiction, and the page still answers it.
   */
  if (!project || (company && project.companyId !== company)) notFound();

  const [documents, tasks] = await Promise.all([
    managerApi.documents(project.companyId),
    managerApi.tasks(project.id),
  ]);

  const attached = documents.filter((d) => d.project === project.name);

  return (
    <>
      {/* No Assign control: the specialist follows the company's staffing for
          this project's service line, set on the Companies screen. */}
      <PageHeader title="Project Information" description={project.name} />

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
            <DetailRow
              label="Specialist"
              value={project.specialist ?? "Unassigned"}
            />
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
